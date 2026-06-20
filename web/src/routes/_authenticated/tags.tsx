// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useTags } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { TagsList, TagsListSkeleton } from '@/features/wiki/tags-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/tags')({
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
