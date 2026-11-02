// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonymousRefusal, classPath, toClassScopedUrl } from './request'

// What the server tells the page about its route. Core names the app on a
// domain route as well as on the app's own path, so getAppPath answers
// "/wikis" even where the URL does not carry it; base is the route's own path.
const path = vi.hoisted(() => ({
  app: '/wikis',
  domain: false,
  base: '/wikis/',
}))

vi.mock('@mochi/web', () => ({
  getAppBasepath: () => path.base,
  getAppPath: () => path.app,
  isDomainEntityRouting: () => path.domain,
  requestHelpers: {
    isAuthError: (error: unknown) =>
      (error as { status?: number } | null)?.status === 401,
  },
}))

afterEach(() => {
  path.app = '/wikis'
  path.domain = false
  path.base = '/wikis/'
})

// With no account to list wikis for, core answers an anonymous visitor's
// class-level request with 401. On the app's own path that visitor belongs on
// the sign-in landing page; on a domain-routed host the route owner's wikis
// answer anonymously, so a 401 there is a real error to show.
describe('anonymous refusal', () => {
  it('is a 401 on the app path', () => {
    expect(anonymousRefusal({ status: 401 })).toBe(true)
  })

  it('is not a 401 on a domain-routed host', () => {
    path.domain = true
    expect(anonymousRefusal({ status: 401 })).toBe(false)
  })

  it('is not any other failure', () => {
    expect(anonymousRefusal({ status: 500 })).toBe(false)
    expect(anonymousRefusal(new Error('network'))).toBe(false)
  })
})

describe('class-scoped requests', () => {
  it('go under the app path', () => {
    expect(toClassScopedUrl('-/list')).toBe('/wikis/-/list')
  })

  it('reach the app from a direct entity URL, where the app path is empty', () => {
    // /<entity>/-/list answers the SPA document, not the action.
    path.app = ''
    expect(toClassScopedUrl('-/list')).toBe('/wikis/-/list')
  })

  // docs.mochi-os.org routes the whole domain to one wiki. /wikis/... there
  // is that wiki's page route, which answers the page for every action.
  it('stay at the domain base on a whole-domain route', () => {
    path.domain = true
    path.base = '/'
    expect(toClassScopedUrl('-/info')).toBe('/-/info')
  })

  it('reach the routed wiki by its id on a whole-domain route', () => {
    path.domain = true
    path.base = '/'
    expect(toClassScopedUrl('yuGtwdxVh/-/share')).toBe('/yuGtwdxVh/-/share')
    expect(classPath()).toBe('')
  })

  it('stay under the route on a subpath domain route', () => {
    path.domain = true
    path.base = '/docs/'
    expect(toClassScopedUrl('-/info')).toBe('/docs/-/info')
    expect(classPath()).toBe('/docs')
  })

  it('keep an off-origin-looking URL on this origin', () => {
    expect(toClassScopedUrl('//evil.example/-/list')).toBe(
      '/wikis/evil.example/-/list'
    )
  })
})
