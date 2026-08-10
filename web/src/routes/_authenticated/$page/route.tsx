// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback } from 'react'
import { createFileRoute, Outlet, useRouter } from '@tanstack/react-router'
import { t } from '@lingui/core/macro'
import {
  requestHelpers,
  GeneralError,
  getApiBasepath,
  getErrorMessage,
  getEntityFingerprint,
} from '@mochi/web'
import type { WikiPermissions } from '@/types/wiki'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'

interface WikiInfo {
  id: string
  name: string
  home: string
  fingerprint?: string
  source?: string
}

interface WikiRouteData {
  baseURL: string
  wiki: WikiInfo
  permissions: WikiPermissions
  infoError?: string
}

interface InfoResponse {
  entity: boolean
  wiki?: WikiInfo
  permissions?: WikiPermissions
  fingerprint?: string
}

// Layout for the top-level $page tree, which renders when the wiki is named
// by the URL context rather than a path segment: a domain route (the wiki is
// the hostname) or direct entity routing (the fingerprint is the basepath).
// Mirrors $wikiId/route.tsx — the children are the same page components, and
// they read the wiki and their endpoint base from WikiBaseURLProvider.
export const Route = createFileRoute('/_authenticated/$page')({
  loader: async (): Promise<WikiRouteData> => {
    // getApiBasepath resolves the entity endpoint prefix for whichever
    // context mounted us: "/-/" on a whole-domain route, "/<route>/-/" on a
    // subpath route, "/<fingerprint>/-/" on direct entity routing.
    const baseURL = getApiBasepath()
    const fingerprint = getEntityFingerprint() ?? ''

    let info: InfoResponse | null = null
    let infoError: string | undefined
    try {
      info = await requestHelpers.get<InfoResponse>(`${baseURL}info`)
    } catch (error) {
      // Keep wiki routes usable when info is temporarily unavailable.
      infoError = getErrorMessage(error, t`Failed to load wiki info`)
    }

    if (!info?.wiki) {
      return {
        baseURL,
        wiki: { id: fingerprint, name: fingerprint, home: 'home', fingerprint },
        permissions: { view: false, edit: false, delete: false, manage: false },
        infoError: infoError ?? t`Wiki not found`,
      }
    }

    return {
      baseURL,
      wiki: info.wiki,
      permissions: info.permissions ?? { view: false, edit: false, delete: false, manage: false },
      ...(infoError ? { infoError } : {}),
    }
  },
  component: WikiPageLayout,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function WikiPageLayout() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const retryLoadInfo = useCallback(() => {
    void router.invalidate()
  }, [router])

  return (
    <WikiBaseURLProvider baseURL={data.baseURL} wiki={data.wiki} permissions={data.permissions}>
      {data.infoError ? (
        <GeneralError
          error={data.infoError}
          minimal
          mode='inline'
          reset={retryLoadInfo}
          className='px-4 pt-4'
        />
      ) : null}
      <Outlet />
    </WikiBaseURLProvider>
  )
}
