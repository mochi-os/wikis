// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Not colocated under src/routes: the route generator turns any file there
// into a route.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return { ...original, requestHelpers: { ...original.requestHelpers, get } }
})

// The page view's own parts are not what is measured here: only which
// requests it makes when it mounts.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  Navigate: () => null,
}))
vi.mock('@/features/wiki/page-view', () => ({
  PageView: () => <div>page</div>,
  PageNotFound: () => null,
  PageViewSkeleton: () => null,
}))
vi.mock('@/features/wiki/page-header', () => ({ PageHeader: () => null }))
vi.mock('@/features/wiki/wiki-route-header', () => ({
  WikiRouteHeader: () => null,
}))
vi.mock('@/features/wiki/page-actions-menu', () => ({
  PageActionsMenu: () => null,
  PageMissingMenu: () => null,
}))
vi.mock('@/features/wiki/delete-page', () => ({ DeletePageDialog: () => null }))
vi.mock('@/features/wiki/rename-page-dialog', () => ({
  RenamePageDialog: () => null,
}))
vi.mock('@/components/link-dialog', () => ({
  useWikiLinkDialog: () => ({ openLinkDialog: vi.fn(), linkDialog: null }),
}))
vi.mock('@/hooks/use-rss-copy', () => ({ useRssCopy: () => null }))

const { Route: WikiPageRoute } =
  await import('@/routes/_authenticated/$wikiId/$page/index')
const { Route: DomainPageRoute } =
  await import('@/routes/_authenticated/$page/index')
const { WikiBaseURLProvider } = await import('@/context/wiki-base-url-context')
const { usePage } = await import('./use-wiki')
const { WikiPageContent } = await import('@/features/wiki/wiki-page-content')
const { render, screen } = await import('@testing-library/react')
const { getApiBasepath } = await import('@mochi/web')

type Loader = (context: {
  params: Record<string, string>
  context: { queryClient: QueryClient }
}) => unknown

const permissions = {
  view: true,
  edit: true,
  delete: true,
  manage: true,
  owner: true,
}

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function wrapperFor(queryClient: QueryClient, baseURL: string) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <WikiBaseURLProvider
        baseURL={baseURL}
        wiki={{ id: 'w1', name: 'Docs', home: 'home' }}
        permissions={permissions}
      >
        {children}
      </WikiBaseURLProvider>
    </QueryClientProvider>
  )
}

const page = { page: { slug: 'perf-10', title: 'Perf', content: 'x' } }

describe('wiki page loader', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue(page)
    window.history.replaceState(null, '', '/wikis/yUVSR7upX/perf-10')
  })

  it('asks for the page the address names, without waiting for the info', async () => {
    const queryClient = client()
    void (WikiPageRoute.options.loader as Loader)({
      params: { wikiId: 'yUVSR7upX', page: 'perf-10' },
      context: { queryClient },
    })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/wikis/yUVSR7upX/-/pages/perf-10')
    )
  })

  it('hands the view the page it asked for rather than asking again', async () => {
    const queryClient = client()
    await (WikiPageRoute.options.loader as Loader)({
      params: { wikiId: 'yUVSR7upX', page: 'perf-10' },
      context: { queryClient },
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    const view = renderHook(() => usePage('perf-10'), {
      wrapper: wrapperFor(queryClient, '/wikis/yUVSR7upX/-/'),
    })
    await waitFor(() => expect(view.result.current.data).toEqual(page))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('shows the page the loader asked for without asking again', async () => {
    const queryClient = client()
    await (WikiPageRoute.options.loader as Loader)({
      params: { wikiId: 'yUVSR7upX', page: 'perf-10' },
      context: { queryClient },
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    const Wrapper = wrapperFor(queryClient, '/wikis/yUVSR7upX/-/')
    i18n.load('en', {})
    i18n.activate('en')
    render(
      <I18nProvider i18n={i18n}>
        <Wrapper>
          <WikiPageContent wikiId='yUVSR7upX' slug='perf-10' />
        </Wrapper>
      </I18nProvider>
    )
    await screen.findByText('page')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('lets the editor ask again for the page it starts its draft from', async () => {
    const queryClient = client()
    await (WikiPageRoute.options.loader as Loader)({
      params: { wikiId: 'yUVSR7upX', page: 'perf-10' },
      context: { queryClient },
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    renderHook(() => usePage('perf-10', { fresh: true }), {
      wrapper: wrapperFor(queryClient, '/wikis/yUVSR7upX/-/'),
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })
})

describe('domain page loader', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue(page)
  })

  it('asks for the page under the domain base and hands it to the view', async () => {
    const queryClient = client()
    const baseURL = getApiBasepath()
    await (DomainPageRoute.options.loader as Loader)({
      params: { page: 'perf-10' },
      context: { queryClient },
    })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(`${baseURL}pages/perf-10`)
    )
    const view = renderHook(() => usePage('perf-10'), {
      wrapper: wrapperFor(queryClient, baseURL),
    })
    await waitFor(() => expect(view.result.current.data).toEqual(page))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(get).toHaveBeenCalledTimes(1)
  })
})
