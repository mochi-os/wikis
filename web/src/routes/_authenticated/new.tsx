import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { PageEditor } from '@/features/wiki/page-editor'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const searchSchema = z.object({
  slug: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/new')({
  validateSearch: searchSchema,
  component: NewPageRoute,
})

function NewPageRoute() {
  const { t } = useLingui()
  usePageTitle(t`New page`)
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { slug } = Route.useSearch()

  return (
    <>
      <WikiRouteHeader title={t`New page`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <PageEditor slug={slug ?? ''} isNew />
      </Main>
    </>
  )
}
