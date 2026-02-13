import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageTitle } from '@mochi/common'
import { AttachmentsPage, AttachmentsPageSkeleton } from '@/features/wiki/attachments-page'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useAttachments, usePage } from '@/hooks/use-wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/attachments')({
  component: AttachmentsRoute,
})

function AttachmentsRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
  const { data: pageData } = usePage(slug)
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
        <WikiRouteHeader title="Attachments" back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <AttachmentsPageSkeleton viewMode="grid" />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title="Attachments" back={{ label: 'Back to page', onFallback: goBackToPage }} />
      <Main>
        <AttachmentsPage slug={slug} />
      </Main>
    </>
  )
}
