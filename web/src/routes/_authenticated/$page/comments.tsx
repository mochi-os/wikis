import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageTitle, useAuthStore, Main } from '@mochi/common'
import { PageComments } from '@/features/wiki/page-comments'
import { useSidebarContext } from '@/context/sidebar-context'
import { usePermissions } from '@/context/wiki-context'
import { usePage } from '@/hooks/use-wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/comments')({
  component: CommentsRoute,
})

function CommentsRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
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
      <WikiRouteHeader
        title={`${pageTitle} - Comments`}
        back={{ label: 'Back to page', onFallback: goBackToPage }}
      />
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
