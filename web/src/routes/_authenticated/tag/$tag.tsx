import { createFileRoute } from '@tanstack/react-router'
import { useTagPages } from '@/hooks/use-wiki'
import { TagPages, TagPagesSkeleton } from '@/features/wiki/tag-pages'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

export const Route = createFileRoute('/_authenticated/tag/$tag')({
  component: TagPagesRoute,
})

function TagPagesRoute() {
  const params = Route.useParams()
  const tag = params.tag
  const { data, isLoading, error } = useTagPages(tag)

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <TagPagesSkeleton />
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
            Error loading pages: {error.message}
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header />
      <Main>
        <TagPages tag={tag} pages={data?.pages ?? []} />
      </Main>
    </>
  )
}
