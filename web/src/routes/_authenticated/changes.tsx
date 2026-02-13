import { createFileRoute } from '@tanstack/react-router'
import { useChanges } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { Main } from '@mochi/common'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/changes')({
  component: ChangesRoute,
})

function ChangesRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle('Recent changes')
  const { data, isLoading, error } = useChanges()

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title="Recent changes" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <ChangesListSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title="Recent changes" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            Error loading changes: {error.message}
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title="Recent changes" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <ChangesList changes={data?.changes ?? []} />
      </Main>
    </>
  )
}
