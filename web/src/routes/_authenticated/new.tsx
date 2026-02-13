import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/common'
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
  usePageTitle('New page')
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { slug } = Route.useSearch()

  return (
    <>
      <WikiRouteHeader title="New page" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <PageEditor slug={slug ?? ''} isNew />
      </Main>
    </>
  )
}
