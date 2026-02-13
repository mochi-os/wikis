import { useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { FindEntityPage, requestHelpers } from '@mochi/common'
import { useWikiContext } from '@/context/wiki-context'
import { useJoinWiki } from '@/hooks/use-wiki'
import endpoints from '@/api/endpoints'

interface RecommendedWiki {
  id: string
  name: string
  blurb: string
  fingerprint: string
}

interface RecommendationsResponse {
  wikis: RecommendedWiki[]
}

export const Route = createFileRoute('/_authenticated/find')({
  component: FindWikisPage,
})

function FindWikisPage() {
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
    queryFn: () => requestHelpers.get<RecommendationsResponse>(`/wikis/${endpoints.wiki.recommendations}`),
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

  // Subscribe handler with retry logic for 502 errors
  const handleSubscribe = useCallback(async (wikiId: string, entity?: { location?: string; fingerprint?: string }) => {
    return new Promise<void>((resolve, reject) => {
      const onSuccess = (data: { fingerprint: string; home: string }) => {
        navigate({ to: '/$wikiId/$page', params: { wikiId: data.fingerprint, page: data.home } })
        resolve()
      }

      // Try with server location first, retry without if connection fails
      joinWiki.mutate({ target: wikiId, server: entity?.location || undefined }, {
        onSuccess,
        onError: (error) => {
          const status = (error as { status?: number })?.status
          if (status === 502 && entity?.location) {
            joinWiki.mutate({ target: wikiId }, {
              onSuccess,
              onError: reject,
            })
          } else {
            reject(error)
          }
        },
      })
    })
  }, [joinWiki, navigate])

  return (
    <FindEntityPage
      onSubscribe={handleSubscribe}
      subscribedIds={subscribedWikiIds}
      entityClass="wiki"
      searchEndpoint="/wikis/directory/search"
      icon={BookOpen}
      iconClassName="bg-emerald-500/10 text-emerald-600"
      title="Find wikis"
      placeholder="Search by name, ID, fingerprint, or URL..."
      emptyMessage="No wikis found"
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
    />
  )
}
