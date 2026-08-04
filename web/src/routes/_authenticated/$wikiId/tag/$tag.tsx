// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { useTagPages } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { TagPages, TagPagesSkeleton } from '@/features/wiki/tag-pages'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

export const Route = createFileRoute('/_authenticated/$wikiId/tag/$tag')({
  component: WikiTagPagesRoute,
})

function WikiTagPagesRoute() {
  const { t } = useLingui()
  const { wikiId, tag } = Route.useParams()
  const navigate = useNavigate()
  const { wiki } = useWikiBaseURL()
  const goBack = () => navigate({ to: '/$wikiId/tags', params: { wikiId } })
  usePageTitle(t`Tag: ${tag}`)
  const { data, isLoading, error, refetch } = useTagPages(tag)

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: wiki.name, onFallback: goBack }} />
        <Main>
          <TagPagesSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: wiki.name, onFallback: goBack }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  return (
    <>
      <WikiRouteHeader title={t`Tag: ${tag}`} back={{ label: wiki.name, onFallback: goBack }} />
      <Main>
        <TagPages tag={tag} pages={data?.pages ?? []} wikiId={wikiId} />
      </Main>
    </>
  )
}
