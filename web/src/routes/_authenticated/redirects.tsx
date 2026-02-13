import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@mochi/common'
import { RedirectsPage } from '@/features/wiki/redirects-page'
import { Main } from '@mochi/common'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/redirects')({
  component: RedirectsRoute,
})

function RedirectsRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle('Redirects')
  return (
    <>
      <WikiRouteHeader title="Redirects" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <RedirectsPage />
      </Main>
    </>
  )
}
