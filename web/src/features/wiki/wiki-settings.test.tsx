// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { WikiSettings, type WikiSettingsTabId } from './wiki-settings'

const get = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/w1/settings' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@mochi/web', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mochi/web')>()
  return { ...actual, requestHelpers: { ...actual.requestHelpers, get } }
})

// The replicas tab reads the shell's wiki info; the settings route passes the
// wiki in as a prop, so the context answer is never the one used here.
vi.mock('@/context/wiki-context', () => ({
  useWikiContext: () => ({ info: undefined }),
}))

const permissions = {
  view: true,
  edit: true,
  delete: true,
  manage: true,
  owner: true,
}

function renderTab(tab: WikiSettingsTabId) {
  const wiki = { id: 'w1', name: 'Docs', home: 'home' }
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <WikiBaseURLProvider
          baseURL='/wikis/w1/-/'
          wiki={wiki}
          permissions={permissions}
        >
          <WikiSettings
            activeTab={tab}
            onTabChange={vi.fn()}
            wiki={wiki}
            permissions={permissions}
          />
        </WikiBaseURLProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}

// Long enough for a loop to show: each round is one resolved promise and one
// re-render, so a tab that reloads on its own answer makes dozens of calls.
const settle = () => new Promise((resolve) => setTimeout(resolve, 150))

function callsTo(endpoint: string) {
  return get.mock.calls.filter(([url]) => url === `/wikis/w1/-/${endpoint}`)
}

describe('WikiSettings tabs load once', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({})
  })

  it('requests redirects once', async () => {
    get.mockResolvedValue({ redirects: [] })
    renderTab('redirects')
    await screen.findByText('No redirects configured')
    await settle()
    expect(callsTo('redirects')).toHaveLength(1)
  })

  it('requests access rules once', async () => {
    get.mockResolvedValue({ rules: [] })
    renderTab('access')
    await settle()
    expect(callsTo('access')).toHaveLength(1)
  })

  it('requests replicas once', async () => {
    get.mockResolvedValue({ replicas: [] })
    renderTab('replicas')
    await settle()
    expect(callsTo('replicas')).toHaveLength(1)
  })
})
