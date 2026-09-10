// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { usePageTitle, useAuthStore, Main } from '@mochi/web'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { usePage } from '@/hooks/use-wiki'
import { PageComments } from '@/features/wiki/page-comments'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$wikiId/$page/comments')({
  component: CommentsRoute,
})

function CommentsRoute() {
  const { t } = useLingui()
  const { wikiId, page: slug } = Route.useParams()
  const navigate = useNavigate()
  const goBackToPage = () =>
    navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
  const { permissions } = useWikiBaseURL()
  const identity = useAuthStore((s) => s.identity)

  const { data: pageData } = usePage(slug)
  const pageTitle =
    pageData &&
    'page' in pageData &&
    typeof pageData.page === 'object' &&
    pageData.page?.title
      ? pageData.page.title
      : slug
  usePageTitle(t`${pageTitle} - Comments`)

  return (
    <>
      <WikiRouteHeader
        title={t`${pageTitle} - Comments`}
        back={{ label: t`Back to page`, onFallback: goBackToPage }}
      />
      <Main>
        <PageComments
          slug={slug}
          currentUserId={identity || undefined}
          isOwner={permissions.owner}
          canComment={permissions.edit}
        />
      </Main>
    </>
  )
}
