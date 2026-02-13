import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle } from '@mochi/common'
import { SearchPage } from '@/features/wiki/search-page'
import { Main } from '@mochi/common'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/search')({
  validateSearch: searchSchema,
  component: SearchRoute,
})

function SearchRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle('Search')
  const { q } = Route.useSearch()

  return (
    <>
      <WikiRouteHeader title="Search" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <SearchPage initialQuery={q} />
      </Main>
    </>
  )
}
