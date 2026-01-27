import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requestHelpers, GeneralError } from '@mochi/common'
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
    // Check for entity ID (9-char fingerprint or 50-51 char full ID)
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment) ||
      /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(firstSegment)

    // In entity context, don't prepend app path; in app context, include app path
    const baseURL = isEntityContext
      ? `/${wikiId}/-/`
      : `/${firstSegment}/${wikiId}/-/`

    // Use absolute URL path since apiClient interceptor overwrites baseURL
    const info = await requestHelpers.get<InfoResponse>(`${baseURL}info`)

    if (!info.wiki) {
      throw new Error('Wiki not found')
    }

    return {
      baseURL,
      wiki: info.wiki,
      permissions: info.permissions ?? { view: false, edit: false, delete: false, manage: false },
      fingerprint: info.wiki.fingerprint || wikiId,
    }
  },
  component: WikiLayout,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function WikiLayout() {
  const data = Route.useLoaderData()

  return (
    <WikiBaseURLProvider baseURL={data.baseURL} wiki={data.wiki} permissions={data.permissions}>
      <Outlet />
    </WikiBaseURLProvider>
  )
}
