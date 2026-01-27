import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { usePageHistory } from '@/hooks/use-wiki'
import { usePageTitle, requestHelpers } from '@mochi/common'
import { PageHistory, PageHistorySkeleton } from '@/features/wiki/page-history'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/history/')({
  component: PageHistoryRoute,
})

function PageHistoryRoute() {
  const { wikiId, page: slug } = Route.useParams()
  const { baseURL } = useWikiBaseURL()

  // Fetch page data using the wiki's base URL
  const { data: pageData } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })
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
