import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle, Header, Main } from '@mochi/common'
import { WikiSettings, type WikiSettingsTabId } from '@/features/wiki/wiki-settings'
import { WikiProvider } from '@/context/wiki-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

type SettingsSearch = {
  tab?: WikiSettingsTabId
}

const validTabs: WikiSettingsTabId[] = ['settings', 'access', 'redirects', 'subscribers']

export const Route = createFileRoute('/_authenticated/$wikiId/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: validTabs.includes(search.tab as WikiSettingsTabId) ? (search.tab as WikiSettingsTabId) : undefined,
  }),
  component: WikiSettingsRoute,
})

function WikiSettingsRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { baseURL, wiki, permissions } = useWikiBaseURL()

  const setActiveTab = (newTab: WikiSettingsTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  usePageTitle('Wiki settings')
  return (
    <>
      <Header />
      <Main>
        <WikiProvider>
          <WikiSettings
            activeTab={tab ?? 'settings'}
            onTabChange={setActiveTab}
            baseURL={baseURL}
            wiki={wiki}
            permissions={permissions}
          />
        </WikiProvider>
      </Main>
    </>
  )
}
