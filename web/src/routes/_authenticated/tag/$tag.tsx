import { createFileRoute } from '@tanstack/react-router'
import { useTagPages } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { TagPages, TagPagesSkeleton } from '@/features/wiki/tag-pages'
import { Main } from '@mochi/common'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/tag/$tag')({
  component: TagPagesRoute,
})

function TagPagesRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const params = Route.useParams()
  const tag = params.tag
  usePageTitle(`Tag: ${tag}`)
  const { data, isLoading, error } = useTagPages(tag)

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={`Tag: ${tag}`} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <TagPagesSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={`Tag: ${tag}`} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            Error loading pages: {error.message}
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={`Tag: ${tag}`} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <TagPages tag={tag} pages={data?.pages ?? []} />
      </Main>
    </>
  )
}
