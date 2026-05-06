import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { usePageTitle, Main } from '@mochi/web'
import { WikiSettings, type WikiSettingsTabId } from '@/features/wiki/wiki-settings'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

type SettingsSearch = {
  tab?: WikiSettingsTabId
}

const validTabs: WikiSettingsTabId[] = ['settings', 'access', 'redirects', 'replicas']

export const Route = createFileRoute('/_authenticated/settings')({
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
