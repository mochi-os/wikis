// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Wikis app request helpers
// Uses getAppPath() + '/' as baseURL instead of getApiBasepath()
// This ensures wiki IDs in URLs aren't doubled when on wiki detail pages

import { type AxiosRequestConfig } from 'axios'
import { getAppPath, isDomainEntityRouting, requestHelpers } from '@mochi/web'

// Check if we're in entity context based on browser URL.
// Entity context: first URL segment is an entity ID, or domain-routed entity
// (e.g. docs.mochi-os.org). At the app's class path (/wikis/...) this is false.
export function isEntityContext(): boolean {
  if (isDomainEntityRouting()) return true
  const first = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''
  return (
    /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(first) ||
    /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(first)
  )
}

// Extract the current wiki's entity ID (9-char fingerprint or 50-51 char full
// ID) from a pathname. Covers both URL shapes: /<app>/<entity>/<page> in class
// context and /<entity>/<page> in entity context; null when no segment
// matches (e.g. the wikis list page).
const ENTITY_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

export function getEntityIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  for (const segment of segments.slice(0, 2)) {
    if (ENTITY_ID_PATTERN.test(segment)) {
      return segment
    }
  }
  return null
}

// A protocol-relative URL ("//host/path") also starts with "/", and axios
// treats it as absolute — so passing it through unchanged would send the
// request off-origin. Scope it like any other relative URL instead.
function toClassScopedUrl(url: string): string {
  if (url.startsWith('//')) {
    return `${getAppPath()}/${url.replace(/^\/+/, '')}`
  }

  if (url.startsWith('/') || /^https?:\/\//.test(url)) {
    return url
  }

  return `${getAppPath()}/${url}`
}

export const wikisRequest = {
  get: async <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> => {
    return requestHelpers.get<TResponse>(toClassScopedUrl(url), config)
  },

  post: async <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> => {
    return requestHelpers.post<TResponse, TBody>(
      toClassScopedUrl(url),
      data,
      config
    )
  },
}

// The server keeps only the token's hash, so an issued URL cannot be returned
// again: the response is `{exists: true}` and the caller must pass `regenerate`
// to mint a replacement.
export async function getRssToken(
  entity: string,
  mode: 'changes' | 'comments' | 'all',
  regenerate = false
): Promise<{ token?: string; exists?: boolean }> {
  return wikisRequest.post<{ token?: string; exists?: boolean }>('-/rss/token', {
    entity,
    mode,
    ...(regenerate ? { regenerate: '1' } : {}),
  })
}

// Revoke a wiki's RSS access (deletes the token(s) so the RSS URL stops working)
export async function revokeRssToken(entity: string): Promise<{ ok: boolean }> {
  return wikisRequest.post<{ ok: boolean }>('-/rss/token/revoke', { entity })
}
