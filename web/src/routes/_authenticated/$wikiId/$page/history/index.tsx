// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useEffect, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { usePageHistory } from '@/hooks/use-wiki'
import { GeneralError, Main, requestHelpers, usePageTitle } from '@mochi/web'
import { PageHistory, PageHistorySkeleton } from '@/features/wiki/page-history'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import type { PageResponse, PageNotFoundResponse, Revision } from '@/types/wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

const LIMIT = 50

export const Route = createFileRoute('/_authenticated/$wikiId/$page/history/')({
  component: PageHistoryRoute,
})

function PageHistoryRoute() {
  const { t } = useLingui()
  const { wikiId, page: slug } = Route.useParams()
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  const { baseURL, wiki } = useWikiBaseURL()

  // Fetch page data using the wiki's base URL
  const { data: pageData } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug, baseURL],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })
  const pageTitle = pageData && 'page' in pageData && typeof pageData.page === 'object' && pageData.page?.title ? pageData.page.title : slug
  usePageTitle(t`History: ${pageTitle}`)

  const [offset, setOffset] = useState(0)
  const [allRevisions, setAllRevisions] = useState<Revision[]>([])
  const { data, isLoading, error, refetch } = usePageHistory(slug, { limit: LIMIT, offset })

  const currentPage = data?.revisions ?? []
  const revisions = offset === 0 ? currentPage : [...allRevisions, ...currentPage.filter(r => !allRevisions.some(a => a.id === r.id))]

  const handleLoadMore = () => {
    setAllRevisions(revisions)
    setOffset(offset + LIMIT)
  }

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  if (isLoading && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`History: ${pageTitle}`} back={{ label: wiki.name ?? t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <PageHistorySkeleton />
        </Main>
      </>
    )
  }

  if (error && offset === 0) {
    return (
      <>
        <WikiRouteHeader title={t`History: ${pageTitle}`} back={{ label: wiki.name ?? t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  if (data || revisions.length > 0) {
    const currentVersion = revisions[0]?.version ?? 1
    return (
      <>
        <WikiRouteHeader title={t`History: ${pageTitle}`} back={{ label: wiki.name ?? t`Back to page`, onFallback: goBackToPage }} />
        <Main>
          <PageHistory
            slug={slug}
            revisions={revisions}
            currentVersion={currentVersion}
            wikiId={wikiId}
            total={data?.total}
            offset={offset}
            onLoadMore={handleLoadMore}
          />
        </Main>
      </>
    )
  }

  return null
}
