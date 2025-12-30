import { createFileRoute } from '@tanstack/react-router'
import { useChanges } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/changes')({
  component: ChangesRoute,
})

function ChangesRoute() {
  usePageTitle('Recent changes')
  const { data, isLoading, error } = useChanges()

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <ChangesListSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
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
      <Header />
      <Main>
        <ChangesList changes={data?.changes ?? []} />
      </Main>
    </>
  )
}
