import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { RevertPage } from '@/features/wiki/revert-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

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
  const slug = params.page

  if (!version || version < 1) {
    return (
      <>
        <Header />
        <Main>
          <div className="text-destructive">Invalid version number</div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header />
      <Main>
        <RevertPage slug={slug} version={version} />
      </Main>
    </>
  )
}
