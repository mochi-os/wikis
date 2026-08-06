// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  InlineEntitySearch,
  toastAction,
  getErrorMessage,
  type InlineEntitySearchItem,
} from '@mochi/web'
import { BookOpen } from 'lucide-react'
import endpoints from '@/api/endpoints'
import { wikisRequest } from '@/api/request'
import { useJoinWiki, joinWikiWithRetry } from '@/hooks/use-wiki'

interface DirectoryEntry extends InlineEntitySearchItem {
  fingerprint: string
  location?: string
  /** owner's peer from a mochi:// share-link probe; join pins the same peer. */
  peer?: string
}

interface SearchResponse {
  results: DirectoryEntry[]
}

type ProbeEntry = {
  id: string
  name: string
  fingerprint?: string
  server?: string
  peer?: string
}

interface InlineWikiSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

export function InlineWikiSearch({
  subscribedIds,
  onRefresh,
}: InlineWikiSearchProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const joinWiki = useJoinWiki()

  const search = async (query: string): Promise<DirectoryEntry[]> => {
    try {
      // wikisRequest already unwraps the outer data envelope.
      // Response is {results: [...]}
      const response = await wikisRequest.get<SearchResponse>(
        `${endpoints.wiki.directorySearch}?search=${encodeURIComponent(query)}`
      )
      return response.results ?? []
    } catch (error) {
      // The panel shows error.message, so the server's own wording has to be
      // pulled out here rather than left inside the axios error.
      throw new Error(getErrorMessage(error, t`Failed to search wikis`))
    }
  }

  const probe = async (url: string): Promise<DirectoryEntry[]> => {
    const probed = await wikisRequest.post<
      { data?: ProbeEntry } & Partial<ProbeEntry>
    >(endpoints.wiki.probe, { url })
    const data: Partial<ProbeEntry> = probed?.data ?? probed ?? {}
    return data.id
      ? [
          {
            id: data.id,
            name: data.name ?? '',
            fingerprint: data.fingerprint ?? '',
            location: data.server ?? '',
            peer: data.peer,
          },
        ]
      : []
  }

  const handleSubscribe = async (wiki: DirectoryEntry) => {
    // The join response, not the directory row, carries the fingerprint and
    // home page the reader has to land on.
    const result = await toastAction(
      joinWikiWithRetry(
        joinWiki,
        wiki.id,
        wiki.location || undefined,
        wiki.peer
      ),
      {
        loading: t`Subscribing...`,
        success: t`Subscribed`,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      }
    )
    onRefresh?.()
    void navigate({
      to: '/$wikiId/$page',
      params: {
        wikiId: result.fingerprint ?? result.id,
        page: result.home || 'home',
      },
    })
  }

  return (
    <InlineEntitySearch
      subscribedIds={subscribedIds}
      search={search}
      probe={probe}
      onSubscribe={handleSubscribe}
      icon={BookOpen}
      iconClassName='bg-emerald-500/10 text-emerald-600'
      placeholder={t`Search for wikis...`}
      emptyMessage={t`No wikis found`}
      searchErrorMessage={t`Failed to search wikis`}
      subscribeLabel={t`Subscribe`}
    />
  )
}
