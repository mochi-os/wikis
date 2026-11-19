// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// A page slug, a tag or a wiki id comes from the route or from the wiki's
// source server, so each builder keeps it in one path segment: one holding
// `../delete`, a query or a slash would otherwise aim the request at another
// action. Core routes on the decoded path, so a slash is refused rather than
// encoded.
import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { Route } from '@/routes/_authenticated/$wikiId/route'
import { afterEach, describe, expect, it } from 'vitest'
import { wikiBaseURL } from '@/lib/wiki-base-url'
import endpoints from './endpoints'

const REFUSED = ['../delete', 'a/b', '.', '..', '']

describe('wiki endpoints', () => {
  const builders = {
    page: [endpoints.wiki.page, 'pages/install'],
    pageEdit: [endpoints.wiki.pageEdit, 'pages/install/edit'],
    pageDelete: [endpoints.wiki.pageDelete, 'pages/install/delete'],
    tagRemove: [endpoints.wiki.tagRemove, 'pages/install/tag/remove'],
    commentDelete: [
      endpoints.wiki.commentDelete,
      'pages/install/comment/delete',
    ],
    tagPages: [endpoints.wiki.tagPages, 'tag/install'],
    share: [endpoints.wiki.share, 'install/-/share'],
  } as const

  it.each(Object.entries(builders))('%s keeps a value as is', (_, entry) => {
    const [build, expected] = entry
    expect(build('install')).toBe(expected)
  })

  it.each(Object.entries(builders))(
    '%s refuses a hostile value',
    (_, entry) => {
      const [build] = entry
      for (const value of REFUSED) expect(() => build(value)).toThrow()
    }
  )

  it('encodes a query in a slug into the one segment', () => {
    expect(endpoints.wiki.page('x?y=1')).toBe('pages/x%3Fy%3D1')
  })

  it('puts a version after the slug', () => {
    expect(endpoints.wiki.pageRevision('install', 3)).toBe(
      'pages/install/history/3'
    )
    expect(() => endpoints.wiki.pageRevision('install', NaN)).toThrow()
    expect(() => endpoints.wiki.pageRevision('../delete', 3)).toThrow()
  })
})

describe('wikiBaseURL', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it("names the wiki under the app's path", () => {
    window.history.replaceState(null, '', '/wikis/yUVSR7upX/home')
    expect(wikiBaseURL('yUVSR7upX')).toBe('/wikis/yUVSR7upX/-/')
  })

  it('refuses a wiki id that is not one segment', () => {
    window.history.replaceState(null, '', '/wikis/x')
    for (const id of REFUSED) expect(() => wikiBaseURL(id)).toThrow()
  })

  it("leaves a direct entity address's own base alone", () => {
    window.history.replaceState(null, '', '/yUVSR7upX/home')
    expect(wikiBaseURL('yUVSR7upX')).toBe('/yUVSR7upX/-/')
  })

  it("answers not-found for such an id in the wiki's route", async () => {
    window.history.replaceState(null, '', '/wikis/x')
    const loader = (
      Route.options as unknown as {
        loader: (match: object) => Promise<unknown>
      }
    ).loader
    const answer = loader({
      params: { wikiId: '../delete' },
      context: { queryClient: new QueryClient() },
    })
    await expect(answer).rejects.toSatisfy(isNotFound)
  })
})
