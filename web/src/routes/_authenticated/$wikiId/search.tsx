import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { SearchPage } from '@/features/wiki/search-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$wikiId/search')({
  validateSearch: searchSchema,
  component: WikiSearchRoute,
})

function WikiSearchRoute() {
  const { t } = useLingui()
  const { wikiId } = Route.useParams()
  const navigate = useNavigate()
  const { wiki } = useWikiBaseURL()
  const homeSlug = wiki.home ?? 'home'
  const goBack = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: homeSlug } })
  usePageTitle(t`Search`)
  const { q } = Route.useSearch() as { q?: string }

  return (
    <>
      <WikiRouteHeader
        title={t`Search`}
        back={{ label: wiki.name ?? t`Back`, onFallback: goBack }}
        showSidebarTrigger
      />
      <Main>
        <SearchPage initialQuery={q} wikiId={wikiId} />
      </Main>
    </>
  )
}
