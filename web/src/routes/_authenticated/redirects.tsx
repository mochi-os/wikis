import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@mochi/common'
import { RedirectsPage } from '@/features/wiki/redirects-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/redirects')({
  component: RedirectsRoute,
})

function RedirectsRoute() {
  usePageTitle('Redirects')
  return (
    <>
      <Header />
      <Main>
        <RedirectsPage />
      </Main>
    </>
  )
}
