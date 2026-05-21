import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useChanges } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

const LIMIT = 50

export const Route = createFileRoute('/_authenticated/$wikiId/changes')({
  component: WikiChangesRoute,
})

function WikiChangesRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const { wikiId } = Route.useParams()
  const { wiki } = useWikiBaseURL()
  const goBack = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: wiki.home ?? 'home' } })
  usePageTitle(t`Recent changes`)

  const [offset, setOffset] = useState(0)
  const [allChanges, setAllChanges] = useState<import('@/types/wiki').Change[]>([])

  const { data, isLoading, error, refetch } = useChanges({ limit: LIMIT, offset })

  // Accumulate pages as user loads more
  const currentPage = data?.changes ?? []
  const changes = offset === 0 ? currentPage : [...allChanges, ...currentPage.filter(c => !allChanges.some(a => a.id === c.id))]

  const handleLoadMore = () => {
    setAllChanges(changes)
    setOffset(offset + LIMIT)
  }

  if (isLoading && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`Recent changes`} back={{ label: wiki.name ?? t`Back`, onFallback: goBack }} showSidebarTrigger />
        <Main>
          <ChangesListSkeleton />
        </Main>
      </>
    )
  }

  if (error && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`Recent changes`} back={{ label: wiki.name ?? t`Back`, onFallback: goBack }} showSidebarTrigger />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`Recent changes`} back={{ label: wiki.name ?? t`Back`, onFallback: goBack }} showSidebarTrigger />
      <Main>
        <ChangesList
          changes={changes}
          wikiId={wikiId}
          total={data?.total}
          offset={offset}
          onLoadMore={handleLoadMore}
        />
      </Main>
    </>
  )
}
