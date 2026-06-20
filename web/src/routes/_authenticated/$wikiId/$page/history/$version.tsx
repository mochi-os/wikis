// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageRevision } from '@/hooks/use-wiki'
import { GeneralError, usePageTitle, Main } from '@mochi/web'
import { RevisionView, RevisionViewSkeleton } from '@/features/wiki/revision-view'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/history/$version')({
  component: RevisionViewRoute,
})

function RevisionViewRoute() {
  const { t } = useLingui()
  const { wikiId, page: slug, version: versionParam } = Route.useParams()
  const version = parseInt(versionParam, 10)
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  usePageTitle(`${slug} v${version}`)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug)
    return () => setPage(null)
  }, [slug, setPage])

  const { data, isLoading, error, refetch } = usePageRevision(slug, version)

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <RevisionViewSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  if (data) {
    return (
      <>
        <WikiRouteHeader title={`${slug} v${version}`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <RevisionView
            slug={slug}
            revision={data.revision}
            currentVersion={data.current_version}
            wikiId={wikiId}
          />
        </Main>
      </>
    )
  }

  return null
}
