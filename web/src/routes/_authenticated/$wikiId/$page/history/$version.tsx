import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageRevision } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { RevisionView, RevisionViewSkeleton } from '@/features/wiki/revision-view'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/history/$version')({
  component: RevisionViewRoute,
})

function RevisionViewRoute() {
  const { wikiId, page: slug, version: versionParam } = Route.useParams()
  const version = parseInt(versionParam, 10)
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  usePageTitle(`${slug} v${version}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

  const { data, isLoading, error } = usePageRevision(slug, version)

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <RevisionViewSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <div className="text-destructive">
            Error loading revision: {error.message}
          </div>
        </Main>
      </>
    )
  }

  if (data) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <RevisionView
            slug={slug}
            revision={data.revision}
            currentVersion={data.current_version}
          />
        </Main>
      </>
    )
  }

  return null
}
