import { createFileRoute } from '@tanstack/react-router'
import { WikiSettings } from '@/features/wiki/wiki-settings'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

export const Route = createFileRoute('/_authenticated/settings')({
  component: WikiSettingsRoute,
})

function WikiSettingsRoute() {
  return (
    <>
      <Header />
      <Main>
        <WikiSettings />
      </Main>
    </>
  )
}
