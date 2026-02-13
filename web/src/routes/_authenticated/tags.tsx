import { createFileRoute } from '@tanstack/react-router'
import { useTags } from '@/hooks/use-wiki'
import { usePageTitle } from '@mochi/common'
import { TagsList, TagsListSkeleton } from '@/features/wiki/tags-list'
import { Main } from '@mochi/common'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/tags')({
  component: TagsRoute,
})

function TagsRoute() {
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle('All tags')
  const { data, isLoading, error } = useTags()

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title="All tags" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <TagsListSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title="All tags" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            Error loading tags: {error.message}
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title="All tags" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <TagsList tags={data?.tags ?? []} />
      </Main>
    </>
  )
}
