// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Not colocated under src/routes: the route generator turns any file there
// into a route.
// A wiki's secondary views - a page's history, one of its versions, its
// comments, the attachments, the recent changes, the tags, one tag's pages
// and a search - each ask for their data from their route's loader, beside
// the wiki route's info, rather than once the info has answered and the
// view has mounted. Each case holds every answer back, so a request seen at
// all was sent before any answered; then it lets them through, mounts the
// view's own hooks under the base the view's route provides, and counts: the
// loader and the hooks share their options, so nothing is asked twice.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return { ...original, requestHelpers: { ...original.requestHelpers, get } }
})

const { getApiBasepath } = await import('@mochi/web')
const { default: endpoints } = await import('@/api/endpoints')
const { WikiBaseURLProvider } = await import('@/context/wiki-base-url-context')
const hooks = await import('./use-wiki')
const routes = {
  history: await import('@/routes/_authenticated/$wikiId/$page/history/index'),
  version:
    await import('@/routes/_authenticated/$wikiId/$page/history/$version'),
  comments: await import('@/routes/_authenticated/$wikiId/$page/comments'),
  attachments:
    await import('@/routes/_authenticated/$wikiId/$page/attachments'),
  changes: await import('@/routes/_authenticated/$wikiId/changes'),
  tags: await import('@/routes/_authenticated/$wikiId/tags'),
  tag: await import('@/routes/_authenticated/$wikiId/tag/$tag'),
  search: await import('@/routes/_authenticated/$wikiId/search'),
}
const domain = {
  history: await import('@/routes/_authenticated/$page/history/index'),
  version: await import('@/routes/_authenticated/$page/history/$version'),
  comments: await import('@/routes/_authenticated/$page/comments'),
  attachments: await import('@/routes/_authenticated/$page/attachments'),
  changes: await import('@/routes/_authenticated/changes'),
  tags: await import('@/routes/_authenticated/tags'),
  tag: await import('@/routes/_authenticated/tag/$tag'),
  search: await import('@/routes/_authenticated/search'),
}

type Loader = (match: {
  params: Record<string, string>
  deps: Record<string, unknown>
  context: { queryClient: QueryClient }
}) => unknown

// What was asked for, as each request's address and search.
let asked: string[] = []
let held: (() => void)[] = []

beforeEach(() => {
  asked = []
  held = []
  get.mockReset()
  get.mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      const search = config?.params
        ? `?${new URLSearchParams(config.params)}`
        : ''
      asked.push(`${url}${search}`)
      return new Promise((resolve) => held.push(() => resolve({})))
    }
  )
  window.history.replaceState(null, '', '/wikis/yUVSR7upX/perf-10')
})

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

// The base each tree's route provides its views: the wiki route's for an
// address naming the wiki, the page route's on a domain or entity address,
// and none for the domain's lists, whose views resolve against the app.
function wrapperFor(queryClient: QueryClient, baseURL: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {baseURL === null ? (
        children
      ) : (
        <WikiBaseURLProvider
          baseURL={baseURL}
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
      )}
    </QueryClientProvider>
  )
}

const slug = 'perf-10'

// Each view, by the hooks it mounts and what they ask for under a base.
const views = {
  history: {
    params: { page: slug },
    deps: {},
    requests: (base: string) => [
      `${base}${endpoints.wiki.page(slug)}`,
      `${base}${endpoints.wiki.pageHistory(slug)}?limit=50&offset=0`,
    ],
    hooks: () => {
      hooks.usePage(slug)
      hooks.usePageHistory(slug, { limit: 50, offset: 0 })
    },
  },
  version: {
    params: { page: slug, version: '3' },
    deps: {},
    requests: (base: string) => [
      `${base}${endpoints.wiki.pageRevision(slug, 3)}`,
    ],
    hooks: () => hooks.usePageRevision(slug, 3),
  },
  comments: {
    params: { page: slug },
    deps: {},
    requests: (base: string) => [
      `${base}${endpoints.wiki.page(slug)}`,
      `${base}${endpoints.wiki.pageComments(slug)}`,
    ],
    hooks: () => {
      hooks.usePage(slug)
      hooks.usePageComments(slug)
    },
  },
  attachments: {
    params: { page: slug },
    deps: {},
    requests: (base: string) => [`${base}${endpoints.wiki.attachments}`],
    hooks: () => hooks.useAttachments(),
  },
  changes: {
    params: {},
    deps: {},
    requests: (base: string) => [
      `${base}${endpoints.wiki.changes}?limit=50&offset=0`,
    ],
    hooks: () => hooks.useChanges({ limit: 50, offset: 0 }),
  },
  tags: {
    params: {},
    deps: {},
    requests: (base: string) => [`${base}${endpoints.wiki.tags}`],
    hooks: () => hooks.useTags(),
  },
  tag: {
    params: { tag: 'alpha' },
    deps: {},
    requests: (base: string) => [`${base}${endpoints.wiki.tagPages('alpha')}`],
    hooks: () => hooks.useTagPages('alpha'),
  },
  search: {
    params: {},
    deps: { q: 'hello' },
    requests: (base: string) => [`${base}${endpoints.wiki.search}?q=hello`],
    hooks: () => hooks.useSearch('hello'),
  },
}

type View = keyof typeof views

async function check(
  route: { Route: { options: object } },
  view: View,
  params: Record<string, string>,
  base: string,
  provided: string | null
) {
  const { deps, requests, hooks: mount } = views[view]
  const queryClient = client()
  const loader = (route.Route.options as { loader: Loader }).loader

  await loader({ params, deps, context: { queryClient } })
  await vi.waitFor(() =>
    expect([...asked].sort()).toEqual([...requests(base)].sort())
  )
  // No answer has arrived: the loader asked before any did.
  expect(held).toHaveLength(requests(base).length)

  for (const answer of held) answer()
  await vi.waitFor(() =>
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .every((query) => query.state.status === 'success')
    ).toBe(true)
  )
  renderHook(mount, { wrapper: wrapperFor(queryClient, provided) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect([...asked].sort()).toEqual([...requests(base)].sort())
}

const viewNames = Object.keys(views) as View[]

describe('wiki secondary route loaders', () => {
  it.each(viewNames)(
    'the %s view, at an address naming the wiki',
    async (view) => {
      const base = '/wikis/yUVSR7upX/-/'
      await check(
        routes[view],
        view,
        { wikiId: 'yUVSR7upX', ...views[view].params },
        base,
        base
      )
    }
  )

  it.each(viewNames)(
    'the %s view, on a domain or entity address',
    async (view) => {
      // A page's views sit under the page route, which provides the entity's
      // base; the lists sit under none and resolve against the app's.
      const provided = ['changes', 'tags', 'tag', 'search'].includes(view)
        ? null
        : getApiBasepath()
      await check(
        domain[view],
        view,
        views[view].params,
        provided ?? '',
        provided
      )
    }
  )

  it('asks for no search the address does not name', async () => {
    const queryClient = client()
    for (const route of [routes.search, domain.search] as {
      Route: { options: object }
    }[]) {
      await (route.Route.options as { loader: Loader }).loader({
        params: { wikiId: 'yUVSR7upX' },
        deps: {},
        context: { queryClient },
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(asked).toEqual([])
  })
})
