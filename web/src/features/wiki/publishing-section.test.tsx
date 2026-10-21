// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublishSwitches, PublishingSection } from './publishing-section'

const state = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  requestHelpers: {
    get: (url: string) => state.get(url),
    post: (url: string, body: unknown) => state.post(url, body),
  },
  toast: { success: state.success, error: state.error },
}))
vi.mock('@/hooks/use-wiki', () => ({
  useEntityEndpoint: () => (endpoint: string) => '/wikis/w1/-/' + endpoint,
}))

const accounts = [
  {
    id: 'm1',
    type: 'mastodon',
    identifier: '@alice@mastodon.social',
    name: 'Alice',
    hosted: false,
  },
  {
    id: 'b1',
    type: 'bluesky',
    identifier: 'alice.example.org',
    name: 'Alice',
    hosted: true,
  },
]

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  )
}

describe('Wiki publishing section', () => {
  beforeEach(() => {
    i18n.load('en', {})
    i18n.activate('en')
    state.get.mockReset().mockResolvedValue({
      accounts,
      publish: ['b1'],
      copies: { b1: 4 },
      public: true,
    })
    state.post.mockReset()
    state.success.mockReset()
    state.error.mockReset()
  })

  it('lists the accounts with a switch each, on for those the wiki publishes to', async () => {
    wrap(<PublishingSection />)
    expect(await screen.findByText('alice.example.org')).toBeTruthy()
    expect(state.get).toHaveBeenCalledWith('/wikis/w1/-/publish')
    expect(screen.getByText('Bluesky · 4 copies')).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: 'Publish to alice.example.org' })
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('shows nothing for a wiki that is not public', async () => {
    state.get.mockResolvedValue({
      accounts,
      publish: [],
      copies: {},
      public: false,
    })
    wrap(<PublishingSection />)
    await waitFor(() => expect(state.get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('alice.example.org')).toBeNull()
  })

  it('sends the new list, and offers to delete the copies left on an account taken off it', async () => {
    state.post.mockImplementation(async (url: string) =>
      url.endsWith('publish/set')
        ? { publish: [], kept: { b1: 4 } }
        : { deleted: 4 }
    )
    wrap(<PublishingSection />)
    fireEvent.click(
      await screen.findByRole('switch', {
        name: 'Publish to alice.example.org',
      })
    )
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith('/wikis/w1/-/publish/set', {
        accounts: '[]',
      })
    )
    expect(
      await screen.findByText(
        'Copies published there: 4. They stay unless you delete them.'
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete copies' }))
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith('/wikis/w1/-/publish/forget', {
        account: 'b1',
      })
    )
    expect(state.success).toHaveBeenCalledWith('Deleted 4 copies')
  })
})

describe('Wiki publish switches', () => {
  beforeEach(() => {
    i18n.load('en', {})
    i18n.activate('en')
    state.get.mockReset().mockResolvedValue({
      accounts,
      publish: ['m1'],
      copies: {},
      public: true,
    })
  })

  it("start from the wiki's list and report a change", async () => {
    const changed = vi.fn()
    wrap(<PublishSwitches chosen={null} onChange={changed} />)
    expect(
      await screen.findByRole('switch', { name: '@alice@mastodon.social' })
    ).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch', { name: 'alice.example.org' }))
    expect(changed).toHaveBeenCalledWith(['m1', 'b1'])
  })
})
