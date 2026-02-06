import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle, useAuthStore, Header, Main } from '@mochi/common'
import { PageComments } from '@/features/wiki/page-comments'
import { useSidebarContext } from '@/context/sidebar-context'
import { usePermissions } from '@/context/wiki-context'
import { usePage } from '@/hooks/use-wiki'

export const Route = createFileRoute('/_authenticated/$page/comments')({
  component: CommentsRoute,
})

function CommentsRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const permissions = usePermissions()
  const identity = useAuthStore((s) => s.identity)

  const { data: pageData } = usePage(slug)
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
