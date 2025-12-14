import { createFileRoute } from '@tanstack/react-router'
import { usePageRevision } from '@/hooks/use-wiki'
import { RevisionView, RevisionViewSkeleton } from '@/features/wiki/revision-view'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/$page/history/$version')({
  component: RevisionViewRoute,
})

function RevisionViewRoute() {
  const params = Route.useParams()
  const slug = params.page
  const version = parseInt(params.version, 10)

  const { data, isLoading, error } = usePageRevision(slug, version)

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <RevisionViewSkeleton />
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
            Error loading revision: {error.message}
          </div>
        </Main>
      </>
    )
  }

  if (data) {
    return (
      <>
        <Header />
        <Main>
          <RevisionView
            slug={slug}
            revision={data.revision}
            currentVersion={data.current_version}
          />
        </Main>
      </>
    )
  }

  return null
}
