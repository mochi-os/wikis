import { useCallback } from 'react'
import { createFileRoute, Outlet, useRouter } from '@tanstack/react-router'
import { requestHelpers, GeneralError, getErrorMessage, isDomainEntityRouting } from '@mochi/web'
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
  fingerprint: string
  infoError?: string
}

interface InfoResponse {
  entity: boolean
  wiki?: WikiInfo
  permissions?: WikiPermissions
  fingerprint?: string
}

export const Route = createFileRoute('/_authenticated/$wikiId')({
  loader: async ({ params }): Promise<WikiRouteData> => {
    const wikiId = params.wikiId
    if (!wikiId) {
      throw new Error('Wiki ID is required')
    }

    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
    // Check for entity ID (9-char fingerprint or 50-51 char full ID) or domain entity routing.
    // When firstSegment === wikiId and it's not an entity ID, we're on a domain-routed page
    // where the segment is a page slug mismatched as $wikiId (shell iframe has no meta tags).
    const ENTITY_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/
    const isEntityContext = isDomainEntityRouting() ||
      ENTITY_ID_RE.test(firstSegment) ||
      (firstSegment === wikiId && !ENTITY_ID_RE.test(wikiId))

    // In entity/domain context, use /-/ prefix; in app context, include app path
    const baseURL = isEntityContext
      ? `/-/`
      : `/${firstSegment}/${wikiId}/-/`

    // Use absolute URL path since apiClient interceptor overwrites baseURL
    let info: InfoResponse | null = null
    let infoError: string | undefined
    try {
      info = await requestHelpers.get<InfoResponse>(`${baseURL}info`)
    } catch (error) {
      // Keep wiki routes usable when info is temporarily unavailable.
      infoError = getErrorMessage(error, 'Failed to load wiki info')
    }

    if (!info?.wiki) {
      return {
        baseURL,
        wiki: { id: wikiId, name: wikiId, home: 'home', fingerprint: wikiId },
        permissions: { view: false, edit: false, delete: false, manage: false },
        fingerprint: wikiId,
        infoError: infoError ?? 'Wiki not found',
      }
    }

    return {
      baseURL,
      wiki: info.wiki,
      permissions: info.permissions ?? { view: false, edit: false, delete: false, manage: false },
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
