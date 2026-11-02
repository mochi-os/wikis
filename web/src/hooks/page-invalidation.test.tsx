// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// A page is held for a while once read, so every change that alters what a
// page shows must mark the held pages stale, and the editor must not start
// its draft from a held copy.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import {
  useDeleteAttachment,
  useDeleteRedirect,
  useInvalidatePages,
  usePage,
  useSetRedirect,
} from './use-wiki'

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return {
    ...original,
    requestHelpers: {
      ...original.requestHelpers,
      get: request.get,
      post: request.post,
    },
  }
})

const base = '/wikis/w1/-/'
const held = ['wiki', base, 'page', 'missing']

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(held, { error: 'not_found' })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <WikiBaseURLProvider
        baseURL={base}
        wiki={{ id: 'w1', name: 'Docs', home: 'home' }}
        permissions={{
          view: true,
          edit: true,
          delete: true,
          manage: true,
          owner: true,
        }}
      >
        {children}
      </WikiBaseURLProvider>
    </QueryClientProvider>
  )
  const stale = () => client.getQueryState(held)?.isInvalidated ?? false
  return { client, wrapper, stale }
}

describe('changes that alter what a page shows', () => {
  beforeEach(() => {
    request.get.mockReset().mockResolvedValue({})
    request.post.mockReset().mockResolvedValue({})
  })

  it('a redirect set marks the held pages stale', async () => {
    // A page held as missing may now redirect.
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useSetRedirect(), { wrapper })
    await act(() =>
      result.current.mutateAsync({ source: 'missing', target: 'home' })
    )
    expect(stale()).toBe(true)
  })

  it('a redirect removed marks the held pages stale', async () => {
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useDeleteRedirect(), { wrapper })
    await act(() => result.current.mutateAsync('missing'))
    expect(stale()).toBe(true)
  })

  it('an attachment deleted marks the held pages stale', async () => {
    // The server rewrites every page that embedded it.
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper })
    await act(() => result.current.mutateAsync('a1'))
    expect(stale()).toBe(true)
  })

  it('the settings page can mark them stale after its own posts', () => {
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useInvalidatePages(), { wrapper })
    act(() => result.current())
    expect(stale()).toBe(true)
  })
})

describe('the editor', () => {
  beforeEach(() => {
    request.get.mockReset()
  })

  it('is given the page read afresh, never a held copy', async () => {
    // Another edit has passed the held copy: a draft seeded from it and
    // saved unchanged would write the old text back over the new.
    const { client, wrapper } = setup()
    client.setQueryData(['wiki', base, 'page', 'p'], {
      page: { version: 3, content: 'old' },
    })
    let answer!: (value: unknown) => void
    request.get.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      })
    )
    const seen: { loading: boolean; version?: number }[] = []
    const { result } = renderHook(
      () => {
        const query = usePage('p', { fresh: true })
        const page = query.data as { page?: { version: number } } | undefined
        seen.push({ loading: query.isLoading, version: page?.page?.version })
        return query
      },
      { wrapper }
    )
    expect(result.current.isLoading).toBe(true)
    act(() => answer({ page: { version: 4, content: 'new' } }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(
      seen.filter((state) => !state.loading).map((state) => state.version)
    ).not.toContain(3)
  })

  it('a reader is shown the held copy at once', () => {
    const { client, wrapper } = setup()
    client.setQueryData(['wiki', base, 'page', 'p'], {
      page: { version: 3, content: 'old' },
    })
    request.get.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => usePage('p'), { wrapper })
    expect(result.current.isLoading).toBe(false)
  })
})
