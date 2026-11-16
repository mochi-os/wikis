// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { Main, usePageTitle } from '@mochi/web'
import { wikiBaseURL } from '@/lib/wiki-base-url'
import { attachmentsQuery } from '@/hooks/use-wiki'
import { AttachmentsPage } from '@/features/wiki/attachments-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute(
  '/_authenticated/$wikiId/$page/attachments'
)({
  // The address names what the view shows, so it is asked for beside the
  // wiki's info rather than once the view has mounted. Not awaited: the
  // view's queries join it.
  loader: ({ params, context }) => {
    void context.queryClient.prefetchQuery(
      attachmentsQuery(wikiBaseURL(params.wikiId))
    )
  },
  component: AttachmentsRoute,
})

function AttachmentsRoute() {
  const { t } = useLingui()
  const { wikiId, page: slug } = Route.useParams()
  const navigate = useNavigate()
  const goBackToPage = () =>
    navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })

  usePageTitle(t`Attachments`)

  return (
    <>
      <WikiRouteHeader
        title={t`Attachments`}
        back={{ label: t`Back to page`, onFallback: goBackToPage }}
      />
      <Main>
        <AttachmentsPage />
      </Main>
    </>
  )
}
