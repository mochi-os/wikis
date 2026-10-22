// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonymousRefusal, toClassScopedUrl } from './request'

const path = vi.hoisted(() => ({ app: '/wikis', domain: false }))

vi.mock('@mochi/web', () => ({
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

  it('stay at the domain base under domain routing', () => {
    path.app = ''
    path.domain = true
    expect(toClassScopedUrl('-/list')).toBe('/-/list')
  })

  it('keep an off-origin-looking URL on this origin', () => {
    expect(toClassScopedUrl('//evil.example/-/list')).toBe(
      '/wikis/evil.example/-/list'
    )
  })
})
