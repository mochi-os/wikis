import { useEffect } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { RevertPage } from '@/features/wiki/revert-page'
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
  const { t } = useLingui()
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
        <WikiRouteHeader title={`Revert: ${slug}`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <div className="text-destructive"><Trans>Invalid version number</Trans></div>
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={`Revert: ${slug}`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
      <Main>
        <RevertPage slug={slug} version={version} />
      </Main>
    </>
  )
}
