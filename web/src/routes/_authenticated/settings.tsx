import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@mochi/common'
import { WikiSettings, type WikiSettingsTabId } from '@/features/wiki/wiki-settings'
import { WikiProvider } from '@/context/wiki-context'
import { Main } from '@mochi/common'
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

  usePageTitle('Wiki settings')
  return (
    <>
      <WikiRouteHeader title="Wiki settings" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <WikiProvider>
          <WikiSettings activeTab={tab ?? 'settings'} onTabChange={setActiveTab} />
        </WikiProvider>
      </Main>
    </>
  )
}
