import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from '@/features/wiki/search-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/search')({
  validateSearch: searchSchema,
  component: SearchRoute,
})

function SearchRoute() {
  const { q } = Route.useSearch()

  return (
    <>
      <Header />
      <Main>
        <SearchPage initialQuery={q} />
      </Main>
    </>
  )
}
