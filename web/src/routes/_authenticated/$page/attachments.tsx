// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Main, usePageTitle } from '@mochi/web'
import { AttachmentsPage } from '@/features/wiki/attachments-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/attachments')({
  component: AttachmentsRoute,
})

function AttachmentsRoute() {
  const { t } = useLingui()
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToPage = () => navigate({ to: '/$page', params: { page: slug } })

  usePageTitle(t`Attachments`)


  return (
    <>
      <WikiRouteHeader title={t`Attachments`} back={{ label: t`Back to page`, onFallback: goBackToPage }} />
      <Main>
        <AttachmentsPage />
      </Main>
    </>
  )
}
