// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Refreshes what a wiki change altered when P2P sync (initial dump or live
// broadcast) writes to the local DB. The Starlark side emits
// {"type":"wiki/update"} and {"type":"wiki/resynced"} on the wiki's
// fingerprint; an update names what changed (kind) and the page concerned.
import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  entityWebsocketManager,
  useAuthStore,
  type EntityWebsocketEvent,
} from '@mochi/web'
import type { PageResponse } from '@/types/wiki'

const WIKI_EVENT_TYPES = new Set(['wiki/update', 'wiki/resynced'])

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

type Key = readonly unknown[]

// The slugs held page queries are keyed by that show the page slug names: the
// slug itself, and a slug a held page was reached by through a redirect to it,
// which is cached under the slug asked for, not its own.
function shownBy(queryClient: QueryClient, slug: string): Set<string> {
  const slugs = new Set([slug])
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['wiki'] })) {
    const key = query.queryKey
    if (key.length !== 4 || key[2] !== 'page') continue
    const data = query.state.data as PageResponse | undefined
    if (data?.page?.slug === slug) slugs.add(String(key[3]))
  }
  return slugs
}

/**
 * Marks stale what one wiki frame changed. Every frame used to refetch the
 * whole wiki tree - the info and the open page included - so a reader sat on
 * one page downloaded it again for each edit anywhere in the wiki. Now:
 * - an edit, a comment or a tag reloads the page it names, under any slug it
 *   is shown by; an edit also the lists that show a page's title and time;
 * - a page created, deleted or renamed, or a redirect set or removed, reloads
 *   every page, since any page's links to missing pages may have changed (a
 *   redirect's slug counts as a page that exists);
 * - an attachment change reloads the pages and comments, which may show it;
 * - anything else - settings, a renamed wiki, a resync, or a frame from an
 *   older wikis app with no kind - reloads everything, as before.
 * The wiki's own info is left alone; the list of wikis, which shows each
 * one's page count and time, is marked stale for its next showing.
 */
export function invalidateForWikiEvent(
  queryClient: QueryClient,
  event: EntityWebsocketEvent
) {
  const kind = event.type === 'wiki/update' ? text(event.kind) : ''
  const page = text(event.page)
  const previous = text(event.previous)
  const stale = (match: (key: Key) => boolean) =>
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'wiki' && match(query.queryKey),
    })
  const section =
    (...names: string[]) =>
    (key: Key) =>
      names.includes(String(key[2]))
  const wikis = (key: Key) => key[1] === 'info' && key[2] === ''

  switch (kind) {
    case 'edit':
    case 'comment':
    case 'tag': {
      const slugs = shownBy(queryClient, page)
      stale(
        (key) =>
          (key[2] === 'page' || (kind === 'comment' && key[2] === 'comments')) &&
          slugs.has(String(key[3]))
      )
      if (kind === 'edit') {
        stale((key) => section('changes', 'search', 'tag')(key) || wikis(key))
      }
      if (kind === 'tag') stale(section('tags', 'tag'))
      return
    }
    case 'redirect':
      stale(section('redirects', 'page'))
      return
    case 'pages':
      stale(
        (key) =>
          section('page', 'changes', 'search', 'tags', 'tag')(key) ||
          (key[2] === 'comments' && (key[3] === page || key[3] === previous)) ||
          wikis(key)
      )
      return
    case 'attachment':
      stale(section('attachments', 'page', 'comments'))
      return
  }
  void queryClient.invalidateQueries({ queryKey: ['wiki'] })
}

// Subscribe to the wiki's WebSocket events and refresh what a change altered
// when remote data (sync dump or live broadcast) lands locally.
export function useWikiWebsocket(wikiFingerprint?: string) {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((state) => state.isInitialized)
  const authToken = useAuthStore((state) => state.token)

  useEffect(() => {
    if (!authReady || !wikiFingerprint) return
    return entityWebsocketManager.subscribe(wikiFingerprint, (event) => {
      if (WIKI_EVENT_TYPES.has(event.type)) {
        invalidateForWikiEvent(queryClient, event)
      }
    })
  }, [authReady, authToken, wikiFingerprint, queryClient])
}
