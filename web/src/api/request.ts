// Wikis app request helpers
// Uses getAppPath() + '/' as baseURL instead of getApiBasepath()
// This ensures wiki IDs in URLs aren't doubled when on wiki detail pages

import axios, { type AxiosRequestConfig } from 'axios'
import { getAppPath, getCookie, useAuthStore } from '@mochi/common'

// Create a wikis-specific axios instance that uses app path as baseURL
// The common apiClient interceptor overrides baseURL, so we need our own instance
const wikisClient = axios.create({
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

wikisClient.interceptors.request.use((config) => {
  // Always use app path as baseURL (class context)
  config.baseURL = getAppPath() + '/'

  // Remove Content-Type for FormData so axios can set the multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  // Add auth token
  const storeToken = useAuthStore.getState().token
  const cookieToken = getCookie('token')
  const token = storeToken || cookieToken

  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }

  return config
})

// Unwrap data envelope if present (backend returns {"data": {...}})
function unwrapData<T>(responseData: unknown): T {
  if (
    responseData &&
    typeof responseData === 'object' &&
    'data' in responseData
  ) {
    return (responseData as { data: T }).data
  }
  return responseData as T
}

export const wikisRequest = {
  get: async <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> => {
    const response = await wikisClient.get<TResponse>(url, config)
    return unwrapData<TResponse>(response.data)
  },

  post: async <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> => {
    const response = await wikisClient.post<TResponse>(url, data, config)
    return unwrapData<TResponse>(response.data)
  },
}

// Get RSS token for a wiki entity and mode
export async function getRssToken(
  entity: string,
  mode: 'changes' | 'comments' | 'all'
): Promise<{ token: string }> {
  return wikisRequest.post<{ token: string }>('/wikis/-/rss/token', { entity, mode })
}

export default wikisRequest
