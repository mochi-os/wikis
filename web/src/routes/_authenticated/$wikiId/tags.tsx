// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useTags } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { TagsList, TagsListSkeleton } from '@/features/wiki/tags-list'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

export const Route = createFileRoute('/_authenticated/$wikiId/tags')({
  component: WikiTagsRoute,
})

function WikiTagsRoute() {
  const { t } = useLingui()
  const { wikiId } = Route.useParams()
  const navigate = useNavigate()
  const { wiki } = useWikiBaseURL()
  const homeSlug = wiki.home ?? 'home'
  const goBack = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: homeSlug } })
  usePageTitle(t`All tags`)
  const { data, isLoading, error, refetch } = useTags()

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={t`All tags`} back={{ label: wiki.name, onFallback: goBack }} />
        <Main>
          <TagsListSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={t`All tags`} back={{ label: wiki.name, onFallback: goBack }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`All tags`} back={{ label: wiki.name, onFallback: goBack }} />
      <Main>
        <TagsList tags={data?.tags ?? []} wikiId={wikiId} />
      </Main>
    </>
  )
}
