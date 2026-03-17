import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle, Main } from '@mochi/web'
import { RedirectsPage } from '@/features/wiki/redirects-page'
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
