import { createFileRoute } from '@tanstack/react-router'
import { WikiSettings } from '@/features/wiki/wiki-settings'
import { WikiProvider } from '@/context/wiki-context'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/settings')({
  component: WikiSettingsRoute,
})

function WikiSettingsRoute() {
  return (
    <>
      <Header />
      <Main>
        <WikiProvider>
          <WikiSettings />
        </WikiProvider>
      </Main>
    </>
  )
}
