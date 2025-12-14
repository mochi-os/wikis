import { createFileRoute } from '@tanstack/react-router'
import { useTags } from '@/hooks/use-wiki'
import { TagsList, TagsListSkeleton } from '@/features/wiki/tags-list'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'

export const Route = createFileRoute('/_authenticated/tags')({
  component: TagsRoute,
})

function TagsRoute() {
  const { data, isLoading, error } = useTags()

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <TagsListSkeleton />
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
            Error loading tags: {error.message}
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header />
      <Main>
        <TagsList tags={data?.tags ?? []} />
      </Main>
    </>
  )
}
