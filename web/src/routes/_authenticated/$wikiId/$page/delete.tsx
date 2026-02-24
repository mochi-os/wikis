import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  EmptyState,
  GeneralError,
  Main,
  Skeleton,
  requestHelpers,
  usePageTitle,
} from '@mochi/common'
import { DeletePage } from '@/features/wiki/delete-page'
import { FileX } from 'lucide-react'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/delete')({
  component: DeletePageRoute,
})

function DeletePageRoute() {
  const { wikiId, page: slug } = Route.useParams()
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  const { baseURL, wiki } = useWikiBaseURL()

  // Fetch page data using the wiki's base URL
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug, baseURL],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })
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
          <DeletePage wikiId={wikiId} slug={slug} title={data.page.title} homePage={wiki.home} />
        </Main>
      </>
    )
  }

  return null
}
