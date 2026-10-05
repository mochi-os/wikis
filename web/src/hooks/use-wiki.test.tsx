// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { useEntityEndpoint } from './use-wiki'

const permissions = {
  view: true,
  edit: true,
  delete: true,
  manage: true,
  owner: true,
}

function wrapperFor(baseURL: string) {
  return ({ children }: { children: ReactNode }) => (
    <WikiBaseURLProvider
      baseURL={baseURL}
      wiki={{ id: 'w1', name: 'Docs', home: 'home' }}
      permissions={permissions}
    >
      {children}
    </WikiBaseURLProvider>
  )
}

describe('useEntityEndpoint', () => {
  // The settings tabs load from an effect that depends on the resolver. A new
  // function per render made that effect run again after every response.
  it('returns the same resolver across renders', () => {
    const { result, rerender } = renderHook(() => useEntityEndpoint(), {
      wrapper: wrapperFor('/wikis/abc/-/'),
    })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('prefixes the wiki base URL in entity context', () => {
    const { result } = renderHook(() => useEntityEndpoint(), {
      wrapper: wrapperFor('/wikis/abc/-/'),
    })
    expect(result.current('access')).toBe('/wikis/abc/-/access')
  })

  it('returns the endpoint as-is in class context', () => {
    const { result, rerender } = renderHook(() => useEntityEndpoint())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(result.current('access')).toBe('access')
  })
})
