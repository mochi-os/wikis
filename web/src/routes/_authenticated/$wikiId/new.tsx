import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle, Header, Main } from '@mochi/common'
import { PageEditor } from '@/features/wiki/page-editor'

const searchSchema = z.object({
  slug: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$wikiId/new')({
  validateSearch: searchSchema,
  component: NewPageRoute,
})

function NewPageRoute() {
  usePageTitle('New page')
  const { slug } = Route.useSearch()

  return (
    <>
      <Header />
      <Main>
        <PageEditor slug={slug ?? ''} isNew />
      </Main>
    </>
  )
}
