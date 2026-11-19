// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { WikiComment } from '@/types/wiki'
import { addressByAuthor, path, tryPath } from '@mochi/web'
import { classPath } from '@/api/request'

// Where an author's person assets (avatar, style) are served: under one of
// their revisions or comments, whose route resolves the author. The ids are
// peers', so they go in through path: one that is not a single segment would
// otherwise point the request at another action, and leaves the address out
// instead, so the avatar falls back to the author's initials.
export const revisionAssets = (wikiId: string, revision: string) =>
  tryPath(() => classPath() + path`/${wikiId}/-/revision/${revision}/asset`)

export const commentAssets = (comment: { wiki: string; id: string }) =>
  tryPath(
    () => classPath() + path`/${comment.wiki}/-/comment/${comment.id}/asset`
  )

/** One of an author's assets, by its slot, under an address above. */
export const asset = (
  assets: string | undefined,
  slot: 'avatar' | 'style'
): string | undefined =>
  assets === undefined ? undefined : `${assets}/${slot}`

// One asset address per author across a list, so the browser and the style
// query fetch each author's avatar once rather than once per row. The routes
// answer for any revision or comment of a wiki the viewer can see, so every
// listed row may stand in for its author.
export const revisionAvatars = (
  wikiId: string,
  rows: readonly { id: string; author: string }[]
): Map<string, string> =>
  addressByAuthor(rows, {
    getAuthor: (row) => row.author,
    getAddress: (row) => revisionAssets(wikiId, row.id),
  })

export const commentAvatars = (
  comments: readonly WikiComment[]
): Map<string, string> =>
  addressByAuthor(comments, {
    getAuthor: (comment) => comment.author,
    getAddress: commentAssets,
    getChildren: (comment) => comment.children,
  })
