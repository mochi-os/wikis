// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import type { RevisionDetail } from '@/types/wiki'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RevisionView } from './revision-view'

const hooks = vi.hoisted(() => ({
  usePageRevision: vi.fn(),
  usePageVersions: vi.fn(),
}))

vi.mock('@/hooks/use-wiki', () => hooks)
vi.mock('./markdown-content', () => ({ MarkdownContent: () => null }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useFormat: () => ({ formatTimestamp: () => '' }),
  useScreenSize: () => ({ isMobile: false }),
  useShellStorage: () => ['unified', () => {}],
  EntityAvatar: () => null,
}))

function revision(version: number, content: string): RevisionDetail {
  return {
    id: `r${version}`,
    title: 'Install',
    author: 'a',
    name: 'Ada',
    created: 0,
    version,
    comment: '',
    content,
  }
}

function show(version: number, current: number) {
  render(
    <I18nProvider i18n={i18n}>
      <RevisionView
        slug='install'
        revision={revision(version, 'new text\n')}
        currentVersion={current}
      />
    </I18nProvider>
  )
}

// The versions the comparison asked the server for.
const asked = () =>
  hooks.usePageRevision.mock.calls
    .filter(([, , opts]) => opts?.enabled)
    .map(([, version]) => version)

beforeEach(() => {
  hooks.usePageRevision.mockReset()
  hooks.usePageVersions.mockReset()
  hooks.usePageRevision.mockImplementation((_slug: string, version: number) =>
    version > 0
      ? {
          data: { revision: revision(version, 'old text\n') },
          isLoading: false,
        }
      : { data: undefined, isLoading: false }
  )
})

describe('Wiki version comparison', () => {
  // The page was made at version 1, deleted at 2 and restored at 3. The delete
  // took a number and saved no revision, so there is no version 2 to load.
  it('opens a restored page on the version before the delete', () => {
    hooks.usePageVersions.mockReturnValue({ data: [3, 1], isLoading: false })
    show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(screen.getByText('Changes from version 1 → 3')).toBeInTheDocument()
    expect(asked()).toContain(1)
    expect(asked()).not.toContain(2)
  })

  it('reads the versions only once the comparison is opened', () => {
    hooks.usePageVersions.mockReturnValue({ data: [3, 1], isLoading: false })
    show(3, 3)
    expect(hooks.usePageVersions).toHaveBeenLastCalledWith('install', {
      enabled: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(hooks.usePageVersions).toHaveBeenLastCalledWith('install', {
      enabled: true,
    })
  })

  it('names no version while the versions are still loading', () => {
    hooks.usePageVersions.mockReturnValue({ data: undefined, isLoading: true })
    show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(screen.queryByText(/Changes from version/)).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(asked()).toEqual([])
  })

  it('says so when the versions could not be read', () => {
    hooks.usePageVersions.mockReturnValue({ data: undefined, isLoading: false })
    show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(
      screen.getByText('Could not load previous version for comparison.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Changes from version/)).toBeNull()
  })

  it('offers no comparison on a page with one version', () => {
    hooks.usePageVersions.mockReturnValue({ data: [1], isLoading: false })
    show(1, 1)
    expect(screen.queryByRole('button', { name: 'Compare changes' })).toBeNull()
  })
})
