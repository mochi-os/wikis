import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePageRevision } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { RevisionView, RevisionViewSkeleton } from '@/features/wiki/revision-view'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'

export const Route = createFileRoute('/_authenticated/$/history/$version')({
  component: RevisionViewRoute,
})

function RevisionViewRoute() {
  const params = Route.useParams()
  const slug = params._splat ?? ''
  const version = parseInt(params.version, 10)
  usePageTitle(`${slug} v${version}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

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
