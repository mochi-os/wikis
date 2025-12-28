import { useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { usePage } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { PageEditor, PageEditorSkeleton } from '@/features/wiki/page-editor'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useAuthStore } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'

export const Route = createFileRoute('/_authenticated/$/edit')({
  beforeLoad: () => {
    const store = useAuthStore.getState()
    if (!store.isInitialized) {
      store.syncFromCookie()
    }
    if (!store.isAuthenticated) {
      throw redirect({ to: '/401' })
    }
  },
  component: WikiPageEditRoute,
})

function WikiPageEditRoute() {
  const params = Route.useParams()
  const slug = params._splat ?? ''
  const { data, isLoading, error } = usePage(slug)
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
        <Header />
        <Main>
          <PageEditorSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
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
        <Header />
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
        <Header />
        <Main>
          <PageEditor page={data.page} slug={slug} />
        </Main>
      </>
    )
  }

  return null
}
