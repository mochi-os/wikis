import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { usePageTitle, useAuthStore, requestHelpers, Header, Main } from '@mochi/common'
import { PageComments } from '@/features/wiki/page-comments'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/comments')({
  component: CommentsRoute,
})

function CommentsRoute() {
  const { wikiId, page: slug } = Route.useParams()
  const { baseURL, permissions } = useWikiBaseURL()
  const identity = useAuthStore((s) => s.identity)

  // Fetch page data for context
  const { data: pageData } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })
  const pageTitle =
    pageData && 'page' in pageData && typeof pageData.page === 'object' && pageData.page?.title
      ? pageData.page.title
      : slug
  usePageTitle(`${pageTitle} - Comments`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  return (
    <>
      <Header>
        <div className="flex flex-1 items-center gap-4">
          <h1 className="truncate text-lg font-semibold">{pageTitle} - Comments</h1>
        </div>
      </Header>
      <Main>
        <PageComments
          slug={slug}
          currentUserId={identity || undefined}
          isOwner={permissions.manage}
          canComment={permissions.edit}
        />
      </Main>
    </>
  )
}
