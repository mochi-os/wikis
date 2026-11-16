// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// A wiki frame names what changed, and only that is marked stale: every frame
// used to refetch the whole wiki tree, so a reader on one page downloaded it,
// and the wiki info, again for each edit anywhere in the wiki.
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateForWikiEvent, useWikiWebsocket } from './use-wiki-websocket'

const { subscribe, auth } = vi.hoisted(() => ({
  subscribe: vi.fn(() => () => {}),
  auth: { isInitialized: true, isAuthenticated: true, token: 'token' },
}))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useAuthStore: (selector: (state: unknown) => unknown) => selector(auth),
  entityWebsocketManager: { subscribe },
}))

const base = '/wikis/w1/-/'
const keys = {
  info: ['wiki', 'info', 'w1'],
  // The list of wikis, with each one's page count and time.
  wikis: ['wiki', 'info', ''],
  a: ['wiki', base, 'page', 'a'],
  // Reached through a redirect to a: cached under the slug asked for.
  r: ['wiki', base, 'page', 'r'],
  b: ['wiki', base, 'page', 'b'],
  history: ['wiki', base, 'page', 'a', 'history', 20, 0],
  commentsA: ['wiki', base, 'comments', 'a'],
  commentsB: ['wiki', base, 'comments', 'b'],
  tags: ['wiki', base, 'tags'],
  // A tag's pages, with each one's title and time.
  tag: ['wiki', base, 'tag', 'x'],
  changes: ['wiki', base, 'changes', 20, 0],
  attachments: ['wiki', base, 'attachments'],
  redirects: ['wiki', base, 'redirects'],
}

function held() {
  const client = new QueryClient()
  for (const [name, key] of Object.entries(keys)) {
    const slug = name === 'r' ? 'a' : String(key[3] ?? '')
    client.setQueryData(key, key[2] === 'page' && key.length === 4 ? { page: { slug } } : { name })
  }
  return client
}

function stale(event: Record<string, unknown>) {
  const client = held()
  invalidateForWikiEvent(client, { type: 'wiki/update', ...event })
  return Object.entries(keys)
    .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort()
}

describe('invalidateForWikiEvent', () => {
  it('reloads an edited page under every slug it is shown by, and nothing else of the page set', () => {
    expect(stale({ kind: 'edit', page: 'a' })).toEqual(
      ['a', 'changes', 'history', 'r', 'tag', 'wikis']
    )
  })

  it('reloads the commented page and its comments', () => {
    expect(stale({ kind: 'comment', page: 'b' })).toEqual(['b', 'commentsB'])
  })

  it('reloads the tagged page and the tag lists', () => {
    expect(stale({ kind: 'tag', page: 'a' })).toEqual(['a', 'history', 'r', 'tag', 'tags'])
  })

  it('reloads every page for a redirect, whose slug counts as a page that exists, and the redirects', () => {
    expect(stale({ kind: 'redirect', page: 'r' })).toEqual(['a', 'b', 'history', 'r', 'redirects'])
  })

  it('reloads every page when the set of pages changes, but not the info', () => {
    expect(stale({ kind: 'pages', page: 'c', previous: 'a' })).toEqual(
      ['a', 'b', 'changes', 'commentsA', 'history', 'r', 'tag', 'tags', 'wikis']
    )
  })

  it('reloads the attachments and the pages and comments that may show them', () => {
    expect(stale({ kind: 'attachment' })).toEqual(
      ['a', 'attachments', 'b', 'commentsA', 'commentsB', 'history', 'r']
    )
  })

  it('reloads everything for a frame that names no kind, and for a resync', () => {
    const everything = Object.keys(keys).sort()
    expect(stale({})).toEqual(everything)
    expect(stale({ kind: 'setting' })).toEqual(everything)
    const client = held()
    invalidateForWikiEvent(client, { type: 'wiki/resynced', kind: 'edit', page: 'a' })
    expect(Object.values(keys).every((key) => client.getQueryState(key)?.isInvalidated)).toBe(true)
  })
})

// Core refuses a socket with no signed-in user, and a refused one is retried
// for as long as the page is open: about 120 refusals an hour for each
// anonymous reader of a public wiki.
describe('useWikiWebsocket for a reader who is not signed in', () => {
  beforeEach(() => {
    subscribe.mockClear()
  })

  function anonymous() {
    Object.assign(auth, { isAuthenticated: false, token: '' })
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    return renderHook(() => useWikiWebsocket('fp1'), { wrapper })
  }

  it('opens no socket', () => {
    anonymous()
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('opens it once the reader signs in', () => {
    const { rerender } = anonymous()
    Object.assign(auth, { isAuthenticated: true, token: 'token' })
    rerender()
    expect(subscribe).toHaveBeenCalledWith('fp1', expect.any(Function))
  })
})
