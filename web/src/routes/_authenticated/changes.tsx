import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useChanges } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const LIMIT = 50

export const Route = createFileRoute('/_authenticated/changes')({
  component: ChangesRoute,
})

function ChangesRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`Recent changes`)

  const [offset, setOffset] = useState(0)
  const [allChanges, setAllChanges] = useState<import('@/types/wiki').Change[]>([])

  const { data, isLoading, error, refetch } = useChanges({ limit: LIMIT, offset })

  const currentPage = data?.changes ?? []
  const changes = offset === 0 ? currentPage : [...allChanges, ...currentPage.filter(c => !allChanges.some(a => a.id === c.id))]

  const handleLoadMore = () => {
    setAllChanges(changes)
    setOffset(offset + LIMIT)
  }

  if (isLoading && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`Recent changes`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <ChangesListSkeleton />
        </Main>
      </>
    )
  }

  if (error && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`Recent changes`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`Recent changes`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <ChangesList
          changes={changes}
          total={data?.total}
          offset={offset}
          onLoadMore={handleLoadMore}
        />
      </Main>
    </>
  )
}
