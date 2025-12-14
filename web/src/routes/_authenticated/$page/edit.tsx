import { createFileRoute, redirect } from '@tanstack/react-router'
import { usePage } from '@/hooks/use-wiki'
import { PageEditor, PageEditorSkeleton } from '@/features/wiki/page-editor'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/$page/edit')({
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
  const slug = params.page
  const { data, isLoading, error } = usePage(slug)

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
