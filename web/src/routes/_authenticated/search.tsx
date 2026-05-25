import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
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
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`Search`)
  const { q } = Route.useSearch()

  const handleQueryChange = useCallback((query: string) => {
    void navigate({ to: '/search', search: { q: query || undefined }, replace: true })
  }, [navigate])

  return (
    <>
      <WikiRouteHeader title={t`Search`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <SearchPage initialQuery={q} onQueryChange={handleQueryChange} />
      </Main>
    </>
  )
}