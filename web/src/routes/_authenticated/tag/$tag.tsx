import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useTagPages } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { TagPages, TagPagesSkeleton } from '@/features/wiki/tag-pages'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/tag/$tag')({
  component: TagPagesRoute,
})

function TagPagesRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const params = Route.useParams()
  const tag = params.tag
  usePageTitle(t`Tag: ${tag}`)
  const { data, isLoading, error, refetch } = useTagPages(tag)

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <TagPagesSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <TagPages tag={tag} pages={data?.pages ?? []} />
      </Main>
    </>
  )
}
