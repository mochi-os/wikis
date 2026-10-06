// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { WikiPage } from '@/types/wiki'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PageView } from './page-view'

// The panel is built from the page's source, not from the rendered markdown,
// so neither the renderer nor the tag footer is needed here.
vi.mock('./markdown-content', () => ({ MarkdownContent: () => null }))
vi.mock('./tag-manager', () => ({ TagManager: () => null }))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useFormat: () => ({ formatTimestamp: () => '' }),
}))

function show(content: string) {
  const page = {
    slug: 'install',
    title: 'Install',
    content,
    tags: [],
    version: 1,
    updated: 0,
  } as unknown as WikiPage
  return render(
    <I18nProvider i18n={i18n}>
      <PageView page={page} />
    </I18nProvider>
  )
}

describe('Wiki page table of contents', () => {
  it('is left out when the page has one heading', () => {
    show('## Installing Mochi from git\n\nTo run Mochi server from git:')
    expect(screen.queryByText('On this page')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('is left out when the page has no heading', () => {
    show('Just a paragraph.')
    expect(screen.queryByText('On this page')).toBeNull()
  })

  it('lists the headings once the page has two', () => {
    show('## Installing\n\nText\n\n## Requirements\n\nMore')
    // Once in the phone bar and once in the desktop column.
    expect(screen.getAllByText('On this page')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Requirements' })).toHaveLength(
      2
    )
  })
})
