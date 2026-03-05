import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle, Main } from '@mochi/common'
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
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })

  const setActiveTab = (newTab: WikiSettingsTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  const { info } = useWikiContext()
  const wikiName = info?.wiki?.name || 'Wiki'
  usePageTitle(`${wikiName} settings`)
  return (
    <>
      <WikiRouteHeader title={`${wikiName} settings`} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <WikiProvider>
          <WikiSettings activeTab={tab ?? 'settings'} onTabChange={setActiveTab} />
        </WikiProvider>
      </Main>
    </>
  )
}
