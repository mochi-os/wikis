import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePage } from '@/hooks/use-wiki'
import { EmptyState, GeneralError, Main, Skeleton, usePageTitle } from '@mochi/common'
import { DeletePage } from '@/features/wiki/delete-page'
import { FileX } from 'lucide-react'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiContext } from '@/context/wiki-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/delete')({
  component: DeletePageRoute,
})

function DeletePageRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
  const { data, isLoading, error, refetch } = usePage(slug)
  const { info } = useWikiContext()
  const homePage = info?.wiki?.home || 'home'
  const pageTitle = data && 'page' in data && typeof data.page === 'object' && data.page?.title ? data.page.title : slug
  usePageTitle(`Delete: ${pageTitle}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={`Delete: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <div className="flex items-center justify-center py-12">
            <Skeleton className="h-64 w-full max-w-md" />
          </div>
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={`Delete: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  // Page not found
  if (data && 'error' in data && data.error === 'not_found') {
    return (
      <>
        <WikiRouteHeader title={`Delete: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <EmptyState
            icon={FileX}
            title={`Page "${slug}" does not exist`}
            className="py-12"
          />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    return (
      <>
        <WikiRouteHeader title={`Delete: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <DeletePage slug={slug} title={data.page.title} homePage={homePage} />
        </Main>
      </>
    )
  }

  return null
}
