import { createFileRoute } from '@tanstack/react-router'
import { useChanges } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/changes')({
  component: ChangesRoute,
})

function ChangesRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle('Recent changes')
  const { data, isLoading, error, refetch } = useChanges()

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
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
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
