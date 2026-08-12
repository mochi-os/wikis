// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { usePageTitle, Main } from '@mochi/web'
import { WikiSettings, type WikiSettingsTabId } from '@/features/wiki/wiki-settings'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { isEntityContext } from '@/api/request'

type SettingsSearch = {
  tab?: WikiSettingsTabId
}

const validTabs: WikiSettingsTabId[] = ['settings', 'access', 'redirects', 'replicas']

export const Route = createFileRoute('/_authenticated/settings')({
  // Entity routing only ({entity}/settings): the fetch resolves against the
  // entity in the URL, and there is no class-level settings action. At the
  // class path the request falls through to the SPA catch-all, which
  // answers 200 with HTML - and request() does not throw on a non-object
  // body, so the page rendered empty rather than failing. Same guard as
  // tags.tsx, which is the identically-shaped route that already had it.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: validTabs.includes(search.tab as WikiSettingsTabId) ? (search.tab as WikiSettingsTabId) : undefined,
  }),
  component: WikiSettingsRoute,
})

function WikiSettingsRoute() {
  const { t } = useLingui()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })

  const setActiveTab = (newTab: WikiSettingsTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  const { info } = useWikiContext()
  const wikiName = info?.wiki?.name || t`Wiki`
  usePageTitle(t`${wikiName} settings`)
  return (
    <>
      <WikiRouteHeader title={t`${wikiName} settings`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <WikiProvider>
          <WikiSettings activeTab={tab ?? 'settings'} onTabChange={setActiveTab} />
        </WikiProvider>
      </Main>
    </>
  )
}
