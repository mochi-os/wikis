import { createFileRoute } from '@tanstack/react-router'
import { RedirectsPage } from '@/features/wiki/redirects-page'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

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
