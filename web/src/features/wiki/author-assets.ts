// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { WikiComment } from '@/types/wiki'
import { addressByAuthor } from '@mochi/web'
import { classPath } from '@/api/request'

// Where an author's person assets (avatar, style) are served: under one of
// their revisions or comments, whose route resolves the author. Append the
// slot. The ids are peers', so they are escaped: a slash or a dot segment in
// one would otherwise point the request at another action.
export const revisionAssets = (wikiId: string, revision: string) =>
  `${classPath()}/${wikiId}/-/revision/${encodeURIComponent(revision)}/asset`

export const commentAssets = (comment: { wiki: string; id: string }) =>
  `${classPath()}/${comment.wiki}/-/comment/${encodeURIComponent(comment.id)}/asset`

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
