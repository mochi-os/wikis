// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Wikis app request helpers
// Uses getAppPath() + '/' as baseURL instead of getApiBasepath()
// This ensures wiki IDs in URLs aren't doubled when on wiki detail pages

import { type AxiosRequestConfig } from 'axios'
import { getAppPath, requestHelpers } from '@mochi/web'

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

// Get RSS token for a wiki entity and mode.
//
// The server keeps only the token's hash, so an already-issued URL cannot be
// handed back: the response is `{exists: true}` instead, and the caller has to
// ask for `regenerate` to mint a replacement. Re-issuing silently would break
// whatever reader is already polling the old URL.
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
