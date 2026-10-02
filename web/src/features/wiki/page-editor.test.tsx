// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { WikiPage } from '@/types/wiki'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageEditor } from './page-editor'

type Block = (locations: {
  current: { pathname: string }
  next: { pathname: string }
}) => boolean

const away = {
  current: { pathname: '/w1/home/edit' },
  next: { pathname: '/w1/home' },
}

// The router's blocker as the editor registers it, and whether each
// navigation the editor makes would have been held at the moment it was made.
const state = vi.hoisted(() => ({
  block: null as Block | null,
  blocked: false,
  proceed: vi.fn(),
  reset: vi.fn(),
  navigate: vi.fn(),
  held: [] as boolean[],
  edit: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => (options: unknown) => {
    state.held.push(state.block!(away))
    state.navigate(options)
  },
  useBlocker: (options: { shouldBlockFn: Block }) => {
    state.block = options.shouldBlockFn
    return state.blocked
      ? { status: 'blocked', proceed: state.proceed, reset: state.reset }
      : { status: 'idle' }
  },
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/hooks/use-wiki', () => ({
  useEditPage: () => ({ mutate: state.edit, isPending: false }),
  useCreatePage: () => ({ mutate: state.create, isPending: false }),
  useAttachments: () => ({
    data: { attachments: [] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUploadAttachment: () => ({
    mutate: vi.fn(),
    isPending: false,
    progress: null,
  }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('./markdown-content', () => ({ MarkdownContent: () => null }))

const page: WikiPage = {
  id: 'p1',
  slug: 'home',
  title: 'Home',
  content: 'Welcome.',
  author: 'a1',
  created: 0,
  updated: 0,
  version: 1,
  tags: [],
}

function show(isNew = false) {
  render(
    <I18nProvider i18n={i18n}>
      {isNew ? (
        <PageEditor slug='' isNew wikiId='w1' />
      ) : (
        <PageEditor page={page} slug='home' wikiId='w1' />
      )}
    </I18nProvider>
  )
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

// Runs the success callback the editor gave its mutation, as the request
// answering would.
function answer(mutate: ReturnType<typeof vi.fn>, result: unknown) {
  const options = mutate.mock.lastCall?.[1] as {
    onSuccess: (result: unknown) => void
  }
  options.onSuccess(result)
}

beforeEach(() => {
  state.block = null
  state.blocked = false
  state.proceed.mockReset()
  state.reset.mockReset()
  state.navigate.mockReset()
  state.held = []
  state.edit.mockReset()
  state.create.mockReset()
})

describe('Page editor leaving', () => {
  it('lets a link away through while nothing is edited', () => {
    show()
    expect(state.block!(away)).toBe(false)
  })

  it('holds a link away while an edit is unsaved', () => {
    show()
    type('Content', 'Welcome back.')
    expect(state.block!(away)).toBe(true)
    type('Content', 'Welcome.')
    expect(state.block!(away)).toBe(false)
    type('Title', 'Start')
    expect(state.block!(away)).toBe(true)
  })

  it('does not hold a new page with nothing typed', () => {
    show(true)
    expect(state.block!(away)).toBe(false)
  })

  it('holds a new page once a title or content is typed', () => {
    show(true)
    type('Title', 'Recipes')
    expect(state.block!(away)).toBe(true)
    type('Title', '')
    type('Content', 'Soup.')
    expect(state.block!(away)).toBe(true)
  })

  it('asks before Cancel drops an edit', () => {
    show()
    type('Content', 'Welcome back.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(state.held).toEqual([true])
  })

  it('leaves without asking after a save', () => {
    show()
    type('Content', 'Welcome back.')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    answer(state.edit, { page })
    expect(state.navigate).toHaveBeenCalledTimes(1)
    expect(state.held).toEqual([false])
  })

  it('leaves without asking after a new page is created', () => {
    show(true)
    type('Title', 'Recipes')
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }))
    answer(state.create, { slug: 'recipes' })
    expect(state.navigate).toHaveBeenCalledTimes(1)
    expect(state.held).toEqual([false])
  })

  it('leaves once the edit is discarded', () => {
    state.blocked = true
    show()
    expect(screen.getByText('Discard changes?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(state.proceed).toHaveBeenCalledTimes(1)
  })

  it('stays when the question is dismissed', () => {
    state.blocked = true
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(state.reset).toHaveBeenCalledTimes(1)
    expect(state.proceed).not.toHaveBeenCalled()
  })
})
