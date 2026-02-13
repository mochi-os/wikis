import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { usePageTitle, requestHelpers } from '@mochi/common'
import { PageEditor, PageEditorSkeleton } from '@/features/wiki/page-editor'
import { Main } from '@mochi/common'
import { useAuthStore } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/edit')({
  beforeLoad: () => {
    const store = useAuthStore.getState()
    if (!store.isInitialized) {
      store.initialize()
    }
    if (!store.isAuthenticated) {
      throw redirect({ to: '/401' })
    }
  },
  component: WikiPageEditRoute,
})

function WikiPageEditRoute() {
  const { wikiId, page: slug } = Route.useParams()
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  const { baseURL } = useWikiBaseURL()

  // Fetch page data using the wiki's base URL (same as view page)
  const { data, isLoading, error } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })
  const pageTitle = data && 'page' in data && typeof data.page === 'object' && data.page?.title ? data.page.title : slug
  usePageTitle(`Edit: ${pageTitle}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={`Edit: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <PageEditorSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={`Edit: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <div className="text-destructive">
            Error loading page: {error.message}
          </div>
        </Main>
      </>
    )
  }

  // Page not found - create new
  if (data && 'error' in data && data.error === 'not_found') {
    return (
      <>
        <WikiRouteHeader title={`Edit: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <PageEditor slug={slug} isNew wikiId={wikiId} />
        </Main>
      </>
    )
  }

  // Page found - edit existing
  if (data && 'page' in data && typeof data.page === 'object') {
    return (
      <>
        <WikiRouteHeader title={`Edit: ${pageTitle}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <PageEditor page={data.page} slug={slug} wikiId={wikiId} />
        </Main>
      </>
    )
  }

  return null
}
