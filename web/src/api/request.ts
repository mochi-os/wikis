// Wikis app request helpers
// Uses getAppPath() + '/' as baseURL instead of getApiBasepath()
// This ensures wiki IDs in URLs aren't doubled when on wiki detail pages

import { type AxiosRequestConfig } from 'axios'
import { getAppPath, requestHelpers } from '@mochi/common'

function toClassScopedUrl(url: string): string {
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

// Get RSS token for a wiki entity and mode
export async function getRssToken(
  entity: string,
  mode: 'changes' | 'comments' | 'all'
): Promise<{ token: string }> {
  return wikisRequest.post<{ token: string }>('-/rss/token', { entity, mode })
}
