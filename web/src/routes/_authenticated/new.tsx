// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import {
  usePageTitle,
  Main,
  requestHelpers,
  getApiBasepath,
  getEntityFingerprint,
} from '@mochi/web'
import { PageEditor } from '@/features/wiki/page-editor'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { wikiInfoKey } from '@/hooks/use-wiki'
import type { WikiPermissions, WikiInfo, InfoResponse } from '@/types/wiki'

const searchSchema = z.object({
  slug: z.string().optional(),
})

interface NewRouteData {
  baseURL: string
  wiki: WikiInfo
  permissions: WikiPermissions
}

// The editor's preview and its insert dialog both resolve attachment URLs
// against the wiki's base URL, and MarkdownContent requires the provider
// outright. /new sits beside the $page tree rather than under it, so it has to
// resolve the same context for itself.
export const Route = createFileRoute('/_authenticated/new')({
  validateSearch: searchSchema,
  loader: async ({ context }): Promise<NewRouteData> => {
    const baseURL = getApiBasepath()
    const fingerprint = getEntityFingerprint() ?? ''
    const fallback: WikiInfo = { id: fingerprint, name: fingerprint, home: 'home', fingerprint }
    const none: WikiPermissions = { view: false, edit: false, delete: false, manage: false, owner: false }

    try {
      const info = await requestHelpers.get<InfoResponse>(`${baseURL}info`)
      context.queryClient.setQueryData(wikiInfoKey(), info)
      return {
        baseURL,
        wiki: info.wiki ?? fallback,
        permissions: info.permissions ?? none,
      }
    } catch {
      // A new page is still worth offering when info is unavailable; the
      // editor degrades to text-only until the save.
      return { baseURL, wiki: fallback, permissions: none }
    }
  },
  component: NewPageRoute,
})

function NewPageRoute() {
  const { t } = useLingui()
  usePageTitle(t`New page`)
  const navigate = Route.useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { slug } = Route.useSearch()
  const data = Route.useLoaderData()

  return (
    <WikiBaseURLProvider baseURL={data.baseURL} wiki={data.wiki} permissions={data.permissions}>
      <WikiRouteHeader title={t`New page`} back={{ label: t`Back to wikis`, onFallback: goBackToWikis }} />
      <Main>
        <PageEditor slug={slug ?? ''} isNew />
      </Main>
    </WikiBaseURLProvider>
  )
}
