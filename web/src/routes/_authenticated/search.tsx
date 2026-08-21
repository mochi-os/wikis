// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { SearchPage } from '@/features/wiki/search-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { isEntityContext } from '@/api/request'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/search')({
  // Entity routing only ({entity}/search): there is no class-level action, and
  // at the class path the request falls through to the SPA catch-all, which
  // answers 200 HTML and renders an empty page.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
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