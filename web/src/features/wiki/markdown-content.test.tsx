// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownContent } from './markdown-content'

vi.mock('@/context/wiki-base-url-context', () => ({
  useWikiBaseURL: () => ({ baseURL: '/wikis/w1/' }),
}))

// A page's body as the app renders it: under the router, on one of the
// screens that show it.
function renderAt(path: string, routes: string[], body: ReactNode) {
  const root = createRootRoute({ component: Outlet })
  const children = routes.map((route) =>
    createRoute({
      getParentRoute: () => root,
      path: route,
      component: () => <I18nProvider i18n={i18n}>{body}</I18nProvider>,
    })
  )
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPreload: false,
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('Wiki heading anchor', () => {
  // jsdom evaluates neither hover nor `(hover: none)`, so the classes are the
  // only thing that says the link shows on a touch screen and on focus.
  it('shows on touch and on keyboard focus, not only on hover', async () => {
    renderAt(
      '/w1/new-1',
      ['/$wikiId/$page'],
      <MarkdownContent content={'## Requirements\n\nGo 1.24'} toc />
    )
    const { className } = await screen.findByRole('link', {
      name: 'Link to Requirements',
    })
    expect(className).toContain('group-hover:opacity-100')
    expect(className).toContain('[@media(hover:none)]:opacity-100')
    expect(className).toContain('focus-visible:opacity-100')
  })
})

const LINKS = [
  '[Changelog](changelog)',
  '[Up](../changelog)',
  '[Section](changelog#install)',
  '[Here](#install)',
].join('\n\n')

async function hrefs() {
  const names = ['Changelog', 'Up', 'Section', 'Here']
  return Promise.all(
    names.map(async (name) =>
      (await screen.findByRole('link', { name })).getAttribute('href')
    )
  )
}

// The screens that show a page's body, as the real route tree names them. A
// page's links are written relative to the page, so they must lead to the
// same place on each.
const WIKI_ROUTES = [
  '/$wikiId/$page',
  '/$wikiId/$page/edit',
  '/$wikiId/$page/comments',
  '/$wikiId/$page/history/$version',
  '/$wikiId/new',
]

describe('Wiki page links', () => {
  afterEach(() => {
    document.querySelector('meta[name="mochi:domain"]')?.remove()
  })

  it.each([
    '/w1/new-1',
    '/w1/new-1/edit',
    '/w1/new-1/comments',
    '/w1/new-1/history/39',
    '/w1/new',
  ])('lead to the wiki page from %s', async (path) => {
    renderAt(path, WIKI_ROUTES, <MarkdownContent content={LINKS} />)
    expect(await hrefs()).toEqual([
      '/w1/changelog',
      '/w1/changelog',
      '/w1/changelog#install',
      '#install',
    ])
  })

  it('navigates to the page and heading from an old version', async () => {
    const router = renderAt(
      '/w1/new-1/history/39',
      WIKI_ROUTES,
      <MarkdownContent content={LINKS} />
    )
    fireEvent.click(await screen.findByRole('link', { name: 'Section' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/w1/changelog')
    )
    expect(router.state.location.hash).toBe('install')
  })

  it.each(['/new-1', '/new-1/history/39'])(
    'lead to the page at the domain root from %s',
    async (path) => {
      const meta = document.createElement('meta')
      meta.name = 'mochi:domain'
      meta.content = '/'
      document.head.appendChild(meta)
      renderAt(
        path,
        ['/$page', '/$page/history/$version'],
        <MarkdownContent content={LINKS} />
      )
      expect(await hrefs()).toEqual([
        '/changelog',
        '/changelog',
        '/changelog#install',
        '#install',
      ])
    }
  )
})
