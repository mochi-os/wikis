import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle } from '@mochi/common'
import { RevertPage } from '@/features/wiki/revert-page'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const searchSchema = z.object({
  version: z.coerce.number(),
})

export const Route = createFileRoute('/_authenticated/$page/revert')({
  validateSearch: searchSchema,
  component: RevertPageRoute,
})

function RevertPageRoute() {
  const params = Route.useParams()
  const { version } = Route.useSearch()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })
  usePageTitle(`Revert: ${slug}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

  if (!version || version < 1) {
    return (
      <>
        <WikiRouteHeader title={`Revert: ${slug}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
        <Main>
          <div className="text-destructive">Invalid version number</div>
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={`Revert: ${slug}`} back={{ label: 'Back to page', onFallback: goBackToPage }} />
      <Main>
        <RevertPage slug={slug} version={version} />
      </Main>
    </>
  )
}
