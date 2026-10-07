// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { useEntityEndpoint, usePageVersions } from './use-wiki'

const get = vi.hoisted(() => vi.fn())

vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return { ...original, requestHelpers: { ...original.requestHelpers, get } }
})

const permissions = {
  view: true,
  edit: true,
  delete: true,
  manage: true,
  owner: true,
}

function wrapperFor(baseURL: string) {
  return ({ children }: { children: ReactNode }) => (
    <WikiBaseURLProvider
      baseURL={baseURL}
      wiki={{ id: 'w1', name: 'Docs', home: 'home' }}
      permissions={permissions}
    >
      {children}
    </WikiBaseURLProvider>
  )
}

describe('useEntityEndpoint', () => {
  // The settings tabs load from an effect that depends on the resolver. A new
  // function per render made that effect run again after every response.
  it('returns the same resolver across renders', () => {
    const { result, rerender } = renderHook(() => useEntityEndpoint(), {
      wrapper: wrapperFor('/wikis/abc/-/'),
    })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('prefixes the wiki base URL in entity context', () => {
    const { result } = renderHook(() => useEntityEndpoint(), {
      wrapper: wrapperFor('/wikis/abc/-/'),
    })
    expect(result.current('access')).toBe('/wikis/abc/-/access')
  })

  it('returns the endpoint as-is in class context', () => {
    const { result, rerender } = renderHook(() => useEntityEndpoint())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(result.current('access')).toBe('access')
  })
})

describe('usePageVersions', () => {
  const withQueries = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )
  // `count` revisions counting down from `newest`, as the history sends them.
  const answer = (newest: number, count: number, total: number) => ({
    revisions: Array.from({ length: count }, (_, i) => ({
      version: newest - i,
    })),
    total,
  })

  beforeEach(() => get.mockReset())

  // A deleted page takes a version number and saves no revision, so the list
  // is what the history holds, not every number up to the newest.
  it('lists the versions the history holds', async () => {
    get.mockResolvedValueOnce({
      revisions: [{ version: 4 }, { version: 3 }, { version: 1 }],
      total: 3,
    })
    const { result } = renderHook(() => usePageVersions('install'), {
      wrapper: withQueries,
    })
    await waitFor(() => expect(result.current.data).toEqual([4, 3, 1]))
    expect(get).toHaveBeenCalledTimes(1)
  })

  // The history sends 200 at most, so a longer one takes a second request.
  it('reads a long history page by page', async () => {
    get
      .mockResolvedValueOnce(answer(250, 200, 250))
      .mockResolvedValueOnce(answer(50, 50, 250))
    const { result } = renderHook(() => usePageVersions('install'), {
      wrapper: withQueries,
    })
    await waitFor(() => expect(result.current.data).toHaveLength(250))
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      'pages/install/history?limit=200&offset=0',
      'pages/install/history?limit=200&offset=200',
    ])
  })

  it('stops at the total when every answer comes back full', async () => {
    get.mockResolvedValue(answer(400, 200, 400))
    const { result } = renderHook(() => usePageVersions('install'), {
      wrapper: withQueries,
    })
    await waitFor(() => expect(result.current.data).toHaveLength(400))
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('waits until it is enabled', () => {
    renderHook(() => usePageVersions('install', { enabled: false }), {
      wrapper: withQueries,
    })
    expect(get).not.toHaveBeenCalled()
  })
})
