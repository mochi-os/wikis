// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import type { RevisionDetail } from '@/types/wiki'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RevisionView } from './revision-view'

const hooks = vi.hoisted(() => ({
  usePageRevision: vi.fn(),
  usePageVersions: vi.fn(),
  useScreenSize: vi.fn(),
  useShellStorage: vi.fn(),
}))

vi.mock('@/hooks/use-wiki', () => hooks)
vi.mock('./markdown-content', () => ({ MarkdownContent: () => null }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useFormat: () => ({ formatTimestamp: () => '' }),
  useScreenSize: hooks.useScreenSize,
  useShellStorage: hooks.useShellStorage,
  EntityAvatar: () => null,
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value: string
    onValueChange: (value: string) => void
  }) => (
    <select
      aria-label='Comparison version'
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
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
  return render(
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
  hooks.useScreenSize.mockReturnValue({ isMobile: false })
  hooks.useShellStorage.mockReturnValue(['unified', vi.fn()])
  hooks.usePageRevision.mockImplementation((_slug: string, version: number) =>
    version > 0
      ? {
          data: { revision: revision(version, 'old text\n') },
          isLoading: false,
        }
      : { data: undefined, isLoading: false }
  )
})

afterEach(cleanup)

describe('Wiki version comparison', () => {
  // The page was made at version 1, deleted at 2 and restored at 3. The delete
  // took a number and saved no revision, so there is no version 2 to load.
  it('opens a restored page on the version before the delete', () => {
    hooks.usePageVersions.mockReturnValue({ data: [3, 1], isLoading: false })
    show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(screen.getByText('Changes from version 1 → 3')).toBeInTheDocument()
    expect(screen.getByText('old')).toHaveClass('bg-destructive/20')
    expect(screen.getByText('new')).toHaveClass('bg-success/25')
    expect(screen.getByText('old').closest('table')).toHaveClass('text-sm')
    expect(asked()).toContain(1)
    expect(asked()).not.toContain(2)
  })

  it('saves the selected desktop view under the Wiki comparison key', () => {
    const save = vi.fn()
    hooks.useShellStorage.mockReturnValue(['unified', save])
    hooks.usePageVersions.mockReturnValue({ data: [3, 1], isLoading: false })
    show(3, 3)

    expect(hooks.useShellStorage).toHaveBeenCalledWith(
      'wikis.compare',
      'unified'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))

    expect(save).toHaveBeenCalledWith('split')
  })

  it('uses one column on mobile even when the saved desktop choice is split', () => {
    hooks.useScreenSize.mockReturnValue({ isMobile: true })
    hooks.useShellStorage.mockReturnValue(['split', vi.fn()])
    hooks.usePageVersions.mockReturnValue({ data: [3, 1], isLoading: false })
    const { container } = show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))

    expect(screen.queryByRole('button', { name: 'Split' })).toBeNull()
    expect(container.querySelectorAll('td.w-1\\/2')).toHaveLength(0)
    expect(screen.getByText('old')).toBeInTheDocument()
    expect(screen.getByText('new')).toBeInTheDocument()
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
    const error = new Error('History request failed')
    hooks.usePageVersions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error,
    })
    hooks.usePageRevision.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })
    show(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    expect(screen.getByText('History request failed')).toBeInTheDocument()
    expect(
      screen.queryByText('Could not load previous version for comparison.')
    ).toBeNull()
    expect(screen.queryByText(/Changes from version/)).toBeNull()
  })

  it('discards a selected version that is absent from the next page history', () => {
    hooks.usePageVersions.mockImplementation((slug: string) => ({
      data: slug === 'install' ? [3, 2, 1] : [3, 1],
      isLoading: false,
      isError: false,
    }))
    const renderPage = (slug: string) => (
      <I18nProvider i18n={i18n}>
        <RevisionView
          slug={slug}
          revision={revision(3, 'new text\n')}
          currentVersion={3}
        />
      </I18nProvider>
    )
    const view = render(renderPage('install'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare changes' }))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '2' },
    })
    expect(asked()).toContain(2)

    view.rerender(renderPage('another-page'))

    const requested = asked()
    expect(requested[requested.length - 1]).toBe(1)
    expect(screen.getByRole('combobox')).toHaveValue('1')
  })

  it('offers no comparison on a page with one version', () => {
    hooks.usePageVersions.mockReturnValue({ data: [1], isLoading: false })
    show(1, 1)
    expect(screen.queryByRole('button', { name: 'Compare changes' })).toBeNull()
  })
})
