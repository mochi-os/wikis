// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toClassScopedUrl } from './request'

const path = vi.hoisted(() => ({ app: '/wikis', domain: false }))

vi.mock('@mochi/web', () => ({
  getAppPath: () => path.app,
  isDomainEntityRouting: () => path.domain,
  requestHelpers: {},
}))

afterEach(() => {
  path.app = '/wikis'
  path.domain = false
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
