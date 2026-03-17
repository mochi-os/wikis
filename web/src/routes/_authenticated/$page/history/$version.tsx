import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageRevision } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { RevisionView, RevisionViewSkeleton } from '@/features/wiki/revision-view'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/history/$version')({
  component: RevisionViewRoute,
})

function RevisionViewRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const version = parseInt(params.version, 10)
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
  usePageTitle(`${slug} v${version}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

  const { data, isLoading, error, refetch } = usePageRevision(slug, version)

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
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
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
