import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/web'
import { AttachmentsPage } from '@/features/wiki/attachments-page'
import { useSidebarContext } from '@/context/sidebar-context'
import { usePage } from '@/hooks/use-wiki'
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

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  return (
    <>
      <WikiRouteHeader title="Attachments" back={{ label: 'Back to page', onFallback: goBackToPage }} />
      <Main>
        <AttachmentsPage slug={slug} />
      </Main>
    </>
  )
}
