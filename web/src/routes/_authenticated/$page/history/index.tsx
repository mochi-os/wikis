import { createFileRoute } from '@tanstack/react-router'
import { usePageHistory } from '@/hooks/use-wiki'
import { PageHistory, PageHistorySkeleton } from '@/features/wiki/page-history'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/$page/history/')({
  component: PageHistoryRoute,
})

function PageHistoryRoute() {
  const params = Route.useParams()
  const slug = params.page
  const { data, isLoading, error } = usePageHistory(slug)

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <PageHistorySkeleton />
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
            Error loading history: {error.message}
          </div>
        </Main>
      </>
    )
  }

  if (data) {
    // Get current version from the first revision (most recent)
    const currentVersion = data.revisions[0]?.version ?? 1

    return (
      <>
        <Header />
        <Main>
          <PageHistory
            slug={slug}
            revisions={data.revisions}
            currentVersion={currentVersion}
          />
        </Main>
      </>
    )
  }

  return null
}
