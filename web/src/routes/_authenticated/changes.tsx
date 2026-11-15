// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { isEntityContext } from '@/api/request'
import { changesQuery, useChanges } from '@/hooks/use-wiki'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const LIMIT = 50

export const Route = createFileRoute('/_authenticated/changes')({
  // Entity routing only ({entity}/changes): there is no class-level action, and
  // at the class path the request falls through to the SPA catch-all, which
  // answers 200 HTML and renders an empty page.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
  // The address names what the view shows, so it is asked for beside the
  // route's code rather than once the view has mounted. Not awaited: the
  // view's query joins it. No wiki route holds this view, so its queries are
  // scoped as the view's are, to the app's own base.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(changesQuery('', LIMIT, 0))
  },
  component: ChangesRoute,
})

function ChangesRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`Recent changes`)

  const [offset, setOffset] = useState(0)
  const [allChanges, setAllChanges] = useState<import('@/types/wiki').Change[]>(
    []
  )

  const { data, isLoading, error, refetch } = useChanges({
    limit: LIMIT,
    offset,
  })

  const currentPage = data?.changes ?? []
  const changes =
    offset === 0
      ? currentPage
      : [
          ...allChanges,
          ...currentPage.filter((c) => !allChanges.some((a) => a.id === c.id)),
        ]

  const handleLoadMore = () => {
    setAllChanges(changes)
    setOffset(offset + LIMIT)
  }

  if (isLoading && offset === 0) {
    return (
      <>
        <WikiRouteHeader
          title={t`Recent changes`}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main>
          <ChangesListSkeleton />
        </Main>
      </>
    )
  }

  if (error && offset === 0) {
    return (
      <>
        <WikiRouteHeader
          title={t`Recent changes`}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main>
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader
        title={t`Recent changes`}
        back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
      />
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
