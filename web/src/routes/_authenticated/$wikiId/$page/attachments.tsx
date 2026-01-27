import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { usePageTitle, requestHelpers } from '@mochi/common'
import { AttachmentsPage, AttachmentsPageSkeleton } from '@/features/wiki/attachments-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useAttachments } from '@/hooks/use-wiki'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/attachments')({
  component: AttachmentsRoute,
})

function AttachmentsRoute() {
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
  usePageTitle('Attachments')
  const { isLoading } = useAttachments()

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
          <AttachmentsPageSkeleton viewMode="grid" />
        </Main>
      </>
    )
  }

  return (
    <>
      <Header />
      <Main>
        <AttachmentsPage slug={slug} />
      </Main>
    </>
  )
}
