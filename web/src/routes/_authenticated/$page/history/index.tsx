import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePage, usePageHistory } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { PageHistory, PageHistorySkeleton } from '@/features/wiki/page-history'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'

export const Route = createFileRoute('/_authenticated/$page/history/')({
  component: PageHistoryRoute,
})

function PageHistoryRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const { data: pageData } = usePage(slug)
  const pageTitle = pageData && 'page' in pageData && typeof pageData.page === 'object' && pageData.page?.title ? pageData.page.title : slug
  usePageTitle(`History: ${pageTitle}`)
  const { data, isLoading, error } = usePageHistory(slug)

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
          <PageHistorySkeleton />
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
            Error loading history: {error.message}
          </div>
        </Main>
      </>
    )
  }

  if (data) {
    // Get current version from the first revision (most recent)
    const currentVersion = data.revisions[0]?.version ?? 1

    return (
      <>
        <Header />
        <Main>
          <PageHistory
            slug={slug}
            revisions={data.revisions}
            currentVersion={currentVersion}
          />
        </Main>
      </>
    )
  }

  return null
}
