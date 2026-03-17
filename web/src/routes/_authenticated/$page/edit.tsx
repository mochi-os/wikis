import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { usePage } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main, useAuthStore } from '@mochi/web'
import { PageEditor, PageEditorSkeleton } from '@/features/wiki/page-editor'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/edit')({
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
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
  const { data, isLoading, error, refetch } = usePage(slug)
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
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
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
          <PageEditor slug={slug} isNew />
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
          <PageEditor page={data.page} slug={slug} />
        </Main>
      </>
    )
  }

  return null
}
