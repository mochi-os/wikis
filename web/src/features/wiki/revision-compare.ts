// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { parseDiff, type DiffFile, type DiffWords } from '@mochi/web'
import { createTwoFilesPatch, diffWordsWithSpace } from 'diff'

// Every version this one can be compared with, newest first. Versions count up
// from 1 with each save, so the current version bounds the list.
export function compareOptions(version: number, current: number): number[] {
  const options: number[] = []
  for (let v = current; v >= 1; v--) {
    if (v !== version) options.push(v)
  }
  return options
}

// The version a comparison opens on: the one before, which is the change this
// version made. Version 1 has none, so it opens on the one after. 0 when the
// page has a single version and there is nothing to compare.
export function defaultCompare(version: number, current: number): number {
  if (version > 1) return version - 1
  return current > 1 ? 2 : 0
}

// A diff always reads from the older version to the newer one, whichever of
// the two is on screen.
export function compareOrder(
  version: number,
  other: number
): { from: number; to: number } {
  return version < other
    ? { from: version, to: other }
    : { from: other, to: version }
}

// The shared parser reads git's format, which opens each file with this line.
// Every line of the page itself carries a prefix in the patch, so nothing a
// page contains can be taken for a header.
const FILE_HEADER = 'diff --git a/page b/page\n'

// The comparison of two versions of a page, in the shape the shared diff view
// draws. The whole page is kept as context: a wiki page is read as one text,
// and a few lines around each change would hide where in the page it sits.
// Undefined when the two versions hold the same text.
export function pageDiff(before: string, after: string): DiffFile | undefined {
  const patch = createTwoFilesPatch('a/page', 'b/page', before, after, '', '', {
    context: Number.MAX_SAFE_INTEGER,
  })
  return parseDiff(FILE_HEADER + patch).files[0]
}

// Below this share of unchanged text, two lines are different lines rather
// than two versions of one line, and marking nearly every word says less than
// marking none.
const WORD_DIFF_MINIMUM = 0.3

// The changed words of a replaced line and its replacement, or undefined when
// the two have too little in common to be read as one edited line. The
// whitespace-keeping comparison: each side has to rebuild its own line
// exactly, and a wiki line's spacing is part of its markdown.
export const pageWords: DiffWords = (before, after) => {
  const changes = diffWordsWithSpace(before, after)
  let common = 0
  for (const change of changes) {
    if (!change.added && !change.removed) common += change.value.trim().length
  }
  const shorter = Math.min(before.trim().length, after.trim().length)
  if (shorter === 0 || common / shorter < WORD_DIFF_MINIMUM) return undefined
  return changes
}
