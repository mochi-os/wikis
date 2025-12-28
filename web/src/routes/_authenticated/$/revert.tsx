import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle } from '@mochi/common'
import { RevertPage } from '@/features/wiki/revert-page'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'

const searchSchema = z.object({
  version: z.coerce.number(),
})

export const Route = createFileRoute('/_authenticated/$/revert')({
  validateSearch: searchSchema,
  component: RevertPageRoute,
})

function RevertPageRoute() {
  const params = Route.useParams()
  const { version } = Route.useSearch()
  const slug = params._splat ?? ''
  usePageTitle(`Revert: ${slug}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

  if (!version || version < 1) {
    return (
      <>
        <Header />
        <Main>
          <div className="text-destructive">Invalid version number</div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header />
      <Main>
        <RevertPage slug={slug} version={version} />
      </Main>
    </>
  )
}
