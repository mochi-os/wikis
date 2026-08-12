// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useChanges } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { ChangesList, ChangesListSkeleton } from '@/features/wiki/changes-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { isEntityContext } from '@/api/request'

const LIMIT = 50

export const Route = createFileRoute('/_authenticated/changes')({
  // Entity routing only ({entity}/changes): the fetch resolves against the
  // entity in the URL, and there is no class-level All changes action. At the
  // class path the request falls through to the SPA catch-all, which
  // answers 200 with HTML - and request() does not throw on a non-object
  // body, so the page rendered empty rather than failing. Same guard as
  // tags.tsx, which is the identically-shaped route that already had it.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
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
