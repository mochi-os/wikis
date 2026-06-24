// Copyright © 2026 Mochi OÜ
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
import { useJoinWiki } from '@/hooks/use-wiki'
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

  const handleSubscribe = useCallback(async (wikiId: string, entity?: { location?: string; fingerprint?: string }) => {
    const joinWithRetry = async () => {
      try {
        return await joinWiki.mutateAsync({ target: wikiId, server: entity?.location || undefined })
      } catch (error) {
        const status = (error as { status?: number })?.status
        if (status === 502 && entity?.location) {
          return await joinWiki.mutateAsync({ target: wikiId })
        }
        throw error
      }
    }

    try {
      const data = await toastAction(joinWithRetry(), {
        loading: t`Subscribing...`,
        success: t`Subscribed`,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      })
      void navigate({ to: '/$wikiId/$page', params: { wikiId: data.fingerprint, page: data.home } })
    } catch {
      // toast already shown
    }
  }, [joinWiki, navigate, t])

  return (
    <FindEntityPage
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
