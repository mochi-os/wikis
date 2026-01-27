import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePage } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { DeletePage } from '@/features/wiki/delete-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { Skeleton } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiContext } from '@/context/wiki-context'

export const Route = createFileRoute('/_authenticated/$page/delete')({
  component: DeletePageRoute,
})

function DeletePageRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const { data, isLoading, error } = usePage(slug)
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
        <Header />
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
        <Header />
        <Main>
          <div className="text-destructive">
            Error loading page: {error.message}
          </div>
        </Main>
      </>
    )
  }

  // Page not found
  if (data && 'error' in data && data.error === 'not_found') {
    return (
      <>
        <Header />
        <Main>
          <div className="text-muted-foreground py-12 text-center">
            Page "{slug}" does not exist.
          </div>
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    return (
      <>
        <Header />
        <Main>
          <DeletePage slug={slug} title={data.page.title} homePage={homePage} />
        </Main>
      </>
    )
  }

  return null
}
