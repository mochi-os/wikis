// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useCallback } from 'react'
import { createFileRoute, Outlet, useRouter } from '@tanstack/react-router'
import type { WikiPermissions, WikiInfo, InfoResponse } from '@/types/wiki'
import { t } from '@lingui/core/macro'
import {
  requestHelpers,
  GeneralError,
  getErrorMessage,
  isDomainEntityRouting,
} from '@mochi/web'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { wikiInfoKey } from '@/hooks/use-wiki'

interface WikiRouteData {
  baseURL: string
  wiki: WikiInfo
  permissions: WikiPermissions
  fingerprint: string
  infoError?: string
}

export const Route = createFileRoute('/_authenticated/$wikiId')({
  loader: async ({ params, context }): Promise<WikiRouteData> => {
    const wikiId = params.wikiId
    if (!wikiId) {
      throw new Error(t`Wiki ID is required`)
    }

    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
    // A 9-character fingerprint or a 50-51 character entity id.
    const ENTITY_ID_RE =
      /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

    // On a domain route the entity is the host, so its actions sit at /-/.
    // A direct entity URL (/<entity>/<page>) addresses them under the
    // entity; in app context the app path comes first.
    const baseURL =
      isDomainEntityRouting() ||
      (firstSegment === wikiId && !ENTITY_ID_RE.test(wikiId))
        ? `/-/`
        : ENTITY_ID_RE.test(firstSegment)
          ? `/${firstSegment}/-/`
          : `/${firstSegment}/${wikiId}/-/`

    // Use absolute URL path since apiClient interceptor overwrites baseURL
    let info: InfoResponse | null = null
    let infoError: string | undefined
    try {
      info = await requestHelpers.get<InfoResponse>(`${baseURL}info`)
      // Seed the query cache so the provider that mounts under this route
      // reads the answer instead of asking for it a second time.
      context.queryClient.setQueryData(wikiInfoKey(wikiId), info)
    } catch (error) {
      // Keep wiki routes usable when info is temporarily unavailable.
      infoError = getErrorMessage(error, t`Failed to load wiki info`)
    }

    if (!info?.wiki) {
      return {
        baseURL,
        wiki: { id: wikiId, name: wikiId, home: 'home', fingerprint: wikiId },
        permissions: {
          view: false,
          edit: false,
          delete: false,
          manage: false,
          owner: false,
        },
        fingerprint: wikiId,
        infoError: infoError ?? t`Wiki not found`,
      }
    }

    return {
      baseURL,
      wiki: info.wiki,
      permissions: info.permissions ?? {
        view: false,
        edit: false,
        delete: false,
        manage: false,
        owner: false,
      },
      fingerprint: info.wiki.fingerprint || wikiId,
      ...(infoError ? { infoError } : {}),
    }
  },
  component: WikiLayout,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function WikiLayout() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const retryLoadInfo = useCallback(() => {
    void router.invalidate()
  }, [router])

  return (
    <WikiBaseURLProvider
      baseURL={data.baseURL}
      wiki={data.wiki}
      permissions={data.permissions}
    >
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
