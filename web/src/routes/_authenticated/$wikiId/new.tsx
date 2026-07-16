// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { usePageTitle, Main } from '@mochi/web'
import { PageEditor } from '@/features/wiki/page-editor'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'

const searchSchema = z.object({
  slug: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$wikiId/new')({
  validateSearch: searchSchema,
  component: NewPageRoute,
})

function NewPageRoute() {
  const { t } = useLingui()
  usePageTitle(t`New page`)
  const { wikiId } = Route.useParams()
  const navigate = useNavigate()
  const { wiki } = useWikiBaseURL()
  const homeSlug = wiki.home ?? 'home'
  const goBackToWiki = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: homeSlug } })
  const { slug } = Route.useSearch()

  return (
    <>
      <WikiRouteHeader
        title={t`New page`}
        back={{ label: wiki.name ?? t`Back`, onFallback: goBackToWiki }}
        showSidebarTrigger
      />
      <Main>
        <PageEditor slug={slug ?? ''} isNew wikiId={wikiId} />
      </Main>
    </>
  )
}
