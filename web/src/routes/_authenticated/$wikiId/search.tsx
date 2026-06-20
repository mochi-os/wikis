// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
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

  const handleQueryChange = useCallback((query: string) => {
    void navigate({ to: '/$wikiId/search', params: { wikiId }, search: { q: query || undefined }, replace: true })
  }, [navigate, wikiId])

  return (
    <>
      <WikiRouteHeader
        title={t`Search`}
        back={{ label: wiki.name ?? t`Back`, onFallback: goBack }}
        showSidebarTrigger
      />
      <Main>
        <SearchPage initialQuery={q} wikiId={wikiId} onQueryChange={handleQueryChange} />
      </Main>
    </>
  )
}