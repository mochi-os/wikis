// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// An author's avatar route names one of their revisions or comments, so a
// list that built each row's own address fetched the same picture once per
// row: a page edited a hundred times by one person fetched it a hundred times.
import type { ReactNode } from 'react'
import type { Change, Revision, WikiComment } from '@/types/wiki'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WikiBaseURLProvider } from '@/context/wiki-base-url-context'
import { ChangesList } from './changes-list'
import { PageComments } from './page-comments'
import { PageHistory } from './page-history'

const hooks = vi.hoisted(() => ({
  usePageComments: vi.fn(),
  useCreateComment: vi.fn(),
  useEditComment: vi.fn(),
  useDeleteComment: vi.fn(),
}))

vi.mock('@/hooks/use-wiki', () => hooks)
vi.mock('./markdown-content', () => ({ MarkdownContent: () => null }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useFormat: () => ({ formatTimestamp: () => '' }),
  EntityAvatar: ({ src, name }: { src?: string; name: string }) => (
    <img alt={`Avatar for ${name}`} src={src} />
  ),
}))

const sources = (name: string) =>
  screen
    .getAllByAltText(`Avatar for ${name}`)
    .map((img) => img.getAttribute('src'))

const show = (node: ReactNode) =>
  render(<I18nProvider i18n={i18n}>{node}</I18nProvider>)

// The routing metas core puts in a page's head: the app's own path by default,
// as /wikis/<wiki> serves; a test of a domain route replaces them.
function route(metas: Record<string, string>) {
  document.head
    .querySelectorAll('meta[name^="mochi:"]')
    .forEach((m) => m.remove())
  for (const [name, content] of Object.entries(metas)) {
    const m = document.createElement('meta')
    m.setAttribute('name', name)
    m.setAttribute('content', content)
    document.head.appendChild(m)
  }
}

beforeEach(() => {
  i18n.load('en', {})
  i18n.activate('en')
  route({ 'mochi:app': 'wikis' })
})

afterEach(() => route({}))

function row(id: string, author: string) {
  return {
    id,
    slug: 'home',
    title: 'Home',
    author,
    name: author,
    created: 1,
    version: 1,
    comment: '',
  }
}

describe('revision lists', () => {
  const rows = [
    row('r1', 'Ann'),
    row('r2', 'Bob'),
    row('r3', 'Ann'),
    row('r4', 'Bob'),
  ]

  it('recent changes fetch each author once', () => {
    show(<ChangesList changes={rows as Change[]} wikiId='w1' />)
    expect(sources('Ann')).toEqual(
      Array(2).fill('/wikis/w1/-/revision/r1/asset/avatar')
    )
    expect(sources('Bob')).toEqual(
      Array(2).fill('/wikis/w1/-/revision/r2/asset/avatar')
    )
  })

  it('page history fetches each author once', () => {
    show(
      <PageHistory
        slug='home'
        revisions={rows as Revision[]}
        currentVersion={4}
        wikiId='w1'
      />
    )
    expect(sources('Ann')).toEqual(
      Array(2).fill('/wikis/w1/-/revision/r1/asset/avatar')
    )
    expect(sources('Bob')).toEqual(
      Array(2).fill('/wikis/w1/-/revision/r2/asset/avatar')
    )
  })
})

// docs.mochi-os.org routes the whole domain to one wiki, and core names the
// app there too. /wikis/<wiki>/... on that host is the wiki's page route and
// answers the page, not the image.
describe('a whole-domain route', () => {
  it('serves avatars from the routed wiki', () => {
    route({ 'mochi:app': 'wikis', 'mochi:domain': '/' })
    show(<ChangesList changes={[row('r1', 'Ann')] as Change[]} wikiId='w1' />)
    expect(sources('Ann')).toEqual(['/w1/-/revision/r1/asset/avatar'])
  })

  it('serves avatars under a subpath route', () => {
    route({ 'mochi:app': 'wikis', 'mochi:domain': '/docs' })
    show(<ChangesList changes={[row('r1', 'Ann')] as Change[]} wikiId='w1' />)
    expect(sources('Ann')).toEqual(['/docs/w1/-/revision/r1/asset/avatar'])
  })
})

describe('page comments', () => {
  function comment(
    id: string,
    author: string,
    children: WikiComment[] = []
  ): WikiComment {
    return {
      id,
      wiki: 'w1',
      page: 'p1',
      parent: '',
      author,
      name: author,
      body: `Body ${id}`,
      created: 1,
      edited: 0,
      children,
      attachments: [],
    }
  }

  it('fetch each author once, replies included', () => {
    const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), progress: null }
    hooks.useCreateComment.mockReturnValue(idle)
    hooks.useEditComment.mockReturnValue(idle)
    hooks.useDeleteComment.mockReturnValue(idle)
    hooks.usePageComments.mockReturnValue({
      data: {
        comments: [
          comment('c1', 'Bob', [comment('c2', 'Ann'), comment('c3', 'Bob')]),
          comment('c4', 'Ann'),
        ],
        count: 4,
        total: 4,
        truncated: false,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    show(
      <WikiBaseURLProvider
        baseURL='/wikis/w1/-/'
        wiki={{ id: 'w1', name: 'Docs', home: 'home' }}
        permissions={{
          view: true,
          edit: false,
          delete: false,
          manage: false,
          owner: false,
        }}
      >
        <PageComments slug='home' isOwner={false} canComment={false} />
      </WikiBaseURLProvider>
    )
    // Replies come before the next comment, so Ann's first is the reply c2.
    expect(sources('Ann')).toEqual(
      Array(2).fill('/wikis/w1/-/comment/c2/asset/avatar')
    )
    expect(sources('Bob')).toEqual(
      Array(2).fill('/wikis/w1/-/comment/c1/asset/avatar')
    )
  })
})
