// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useTags } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { TagsList, TagsListSkeleton } from '@/features/wiki/tags-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { isEntityContext } from '@/api/request'

export const Route = createFileRoute('/_authenticated/tags')({
  // This route serves entity routing only ({entity}/tags): its fetch resolves
  // against the entity in the URL. At the app's class path there is no entity
  // and no class-level tags action, so send stray loads to the wikis list.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
  component: TagsRoute,
})

function TagsRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`All tags`)
  const { data, isLoading, error, refetch } = useTags()

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={t`All tags`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <TagsListSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={t`All tags`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`All tags`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <TagsList tags={data?.tags ?? []} />
      </Main>
    </>
  )
}
