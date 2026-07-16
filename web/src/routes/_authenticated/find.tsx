// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { FindEntityPage, toastAction, getErrorMessage, requestHelpers, getAppPath } from '@mochi/web'
import { useWikiContext } from '@/context/wiki-context'
import { useJoinWiki, joinWikiWithRetry } from '@/hooks/use-wiki'
import endpoints from '@/api/endpoints'

interface RecommendedWiki {
  id: string
  name: string
  blurb: string
  fingerprint: string
  server: string
}

interface RecommendationsResponse {
  wikis: RecommendedWiki[]
}

export const Route = createFileRoute('/_authenticated/find')({
  component: FindWikisPage,
})

function FindWikisPage() {
  const { t } = useLingui()
  const { info } = useWikiContext()
  const navigate = useNavigate()
  const joinWiki = useJoinWiki()

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['wikis', 'recommendations'],
    queryFn: () => requestHelpers.get<RecommendationsResponse>(`${getAppPath()}/${endpoints.wiki.recommendations}`),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.wikis ?? []

  const subscribedWikiIds = useMemo(
    () => new Set(
      (info?.wikis || []).flatMap((w) => [w.id, w.fingerprint, w.source].filter((x): x is string => !!x))
    ),
    [info?.wikis]
  )

  const handleSubscribe = useCallback(async (wikiId: string, entity?: { location?: string; fingerprint?: string; peer?: string }) => {
    try {
      const data = await toastAction(
        joinWikiWithRetry(joinWiki, wikiId, entity?.location || undefined, entity?.peer || undefined),
        {
          loading: t`Subscribing...`,
          success: t`Subscribed`,
          error: (e) => getErrorMessage(e, t`Failed to subscribe`),
        }
      )
      void navigate({
        to: '/$wikiId/$page',
        params: { wikiId: data.fingerprint ?? data.id, page: data.home },
      })
    } catch {
      // toast already shown
    }
  }, [joinWiki, navigate, t])

  // Resolve a pasted mochi:// share link to the wiki's name via probe, so the
  // card shows the real wiki rather than a raw entity id.
  const resolveUri = useCallback(async (url: string) => {
    type ProbeEntry = { id: string; name: string; fingerprint?: string; server?: string; peer?: string }
    const response = await requestHelpers.post<{ data?: ProbeEntry } & Partial<ProbeEntry>>(
      `${getAppPath()}/-/probe`,
      { url }
    )
    const data: Partial<ProbeEntry> = response.data ?? response
    if (!data.id) return null
    return { id: data.id, name: data.name ?? '', fingerprint: data.fingerprint, location: data.server ?? '', peer: data.peer }
  }, [])

  return (
    <FindEntityPage
      resolveUri={resolveUri}
      onSubscribe={handleSubscribe}
      subscribedIds={subscribedWikiIds}
      entityClass="wiki"
      searchEndpoint={endpoints.wiki.directorySearch}
      icon={BookOpen}
      iconClassName="bg-emerald-500/10 text-emerald-600"
      title={t`Find wikis`}
      placeholder={t`Search by name, ID, fingerprint, or URL...`}
      emptyMessage={t`No wikis found`}
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
    />
  )
}
