// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { usePageTitle, Main } from '@mochi/web'
import { RedirectsPage } from '@/features/wiki/redirects-page'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { isEntityContext } from '@/api/request'

export const Route = createFileRoute('/_authenticated/redirects')({
  // Entity routing only ({entity}/redirects): there is no class-level action,
  // and at the class path the request falls through to the SPA catch-all, which
  // answers 200 HTML and renders an empty page.
  beforeLoad: () => {
    if (!isEntityContext()) throw redirect({ to: '/' })
  },
  component: RedirectsRoute,
})

function RedirectsRoute() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  usePageTitle(t`Redirects`)
  return (
    <>
      <WikiRouteHeader title={t`Redirects`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <RedirectsPage />
      </Main>
    </>
  )
}
