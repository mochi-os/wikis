// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownContent } from './markdown-content'

vi.mock('@/context/wiki-base-url-context', () => ({
  useWikiBaseURL: () => ({ baseURL: '/wikis/w1/' }),
}))

describe('Wiki heading anchor', () => {
  // jsdom evaluates neither hover nor `(hover: none)`, so the classes are the
  // only thing that says the link shows on a touch screen and on focus.
  it('shows on touch and on keyboard focus, not only on hover', async () => {
    render(
      <I18nProvider i18n={i18n}>
        <MarkdownContent content={'## Requirements\n\nGo 1.24'} toc />
      </I18nProvider>
    )
    const { className } = await screen.findByRole('link', {
      name: 'Link to Requirements',
    })
    expect(className).toContain('group-hover:opacity-100')
    expect(className).toContain('[@media(hover:none)]:opacity-100')
    expect(className).toContain('focus-visible:opacity-100')
  })
})
