// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoveTag, useUpdateAttachment } from './use-wiki'

const post = vi.hoisted(() => vi.fn())

vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return { ...original, requestHelpers: { ...original.requestHelpers, post } }
})

// A removed tag and a new caption show on the click, and go back if the
// server refuses. Outside a wiki's own URL the cache scope is ''.
let refuse: (error: unknown) => void
beforeEach(() => {
  post.mockReset()
  post.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        refuse = reject
      })
  )
})

function mount<T>(hook: () => T, seed: (client: QueryClient) => void) {
  const client = new QueryClient()
  seed(client)
  const view = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  return { client, view }
}

describe('useRemoveTag', () => {
  const key = ['wiki', '', 'page', 'install']

  it('drops the tag at once and puts it back when refused', async () => {
    const { client, view } = mount(
      () => useRemoveTag(),
      (c) => c.setQueryData(key, { page: { tags: ['setup', 'linux'] } })
    )
    const tags = () =>
      client.getQueryData<{ page: { tags: string[] } }>(key)?.page.tags

    act(() => view.result.current.mutate({ slug: 'install', tag: 'setup' }))
    await waitFor(() => expect(tags()).toEqual(['linux']))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(tags()).toEqual(['setup', 'linux'])
  })

  it('leaves a page the server could not find alone', async () => {
    const missing = { error: 'not_found', page: 'install' }
    const { client, view } = mount(
      () => useRemoveTag(),
      (c) => c.setQueryData(key, missing)
    )
    act(() => view.result.current.mutate({ slug: 'install', tag: 'setup' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(client.getQueryData(key)).toEqual(missing)
  })
})

describe('useUpdateAttachment', () => {
  const key = ['wiki', '', 'attachments']

  it('shows the caption at once and the old one back when refused', async () => {
    const { client, view } = mount(
      () => useUpdateAttachment(),
      (c) =>
        c.setQueryData(key, {
          attachments: [
            { id: 'a1', caption: 'Old' },
            { id: 'a2', caption: 'Other' },
          ],
        })
    )
    const captions = () =>
      client
        .getQueryData<{ attachments: { caption: string }[] }>(key)
        ?.attachments.map((a) => a.caption)

    act(() => view.result.current.mutate({ id: 'a1', caption: 'New' }))
    await waitFor(() => expect(captions()).toEqual(['New', 'Other']))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(captions()).toEqual(['Old', 'Other'])
  })
})
