import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { SearchPage } from '@/features/wiki/search-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/search')({
  validateSearch: searchSchema,
  component: SearchRoute,
})

function SearchRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`Search`)
  const { q } = Route.useSearch()

  return (
    <>
      <WikiRouteHeader title={t`Search`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <SearchPage initialQuery={q} />
      </Main>
    </>
  )
}
