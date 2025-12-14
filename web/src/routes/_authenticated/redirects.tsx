import { createFileRoute } from '@tanstack/react-router'
import { RedirectsPage } from '@/features/wiki/redirects-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/redirects')({
  component: RedirectsRoute,
})

function RedirectsRoute() {
  return (
    <>
      <Header />
      <Main>
        <RedirectsPage />
      </Main>
    </>
  )
}
