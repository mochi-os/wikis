// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { diffLines, diffWordsWithSpace } from 'diff'

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

// A piece of one diff row. `changed` marks the words that differ from the
// line this one replaced or was replaced by.
export interface DiffSegment {
  text: string
  changed: boolean
}

export interface DiffRow {
  type: 'add' | 'remove' | 'context'
  segments: DiffSegment[]
}

// Below this share of unchanged text, two lines are different lines rather
// than two versions of one line, and marking nearly every word says less than
// marking none.
const WORD_DIFF_MINIMUM = 0.3

// The changed words of a replaced line and its replacement, or undefined when
// the two have too little in common to be read as one edited line.
function wordSegments(
  before: string,
  after: string
): { removed: DiffSegment[]; added: DiffSegment[] } | undefined {
  const removed: DiffSegment[] = []
  const added: DiffSegment[] = []
  let common = 0
  // The whitespace-keeping variant: each side has to rebuild its own line
  // exactly, and a wiki line's spacing is part of its markdown.
  for (const part of diffWordsWithSpace(before, after)) {
    if (part.added) {
      added.push({ text: part.value, changed: true })
    } else if (part.removed) {
      removed.push({ text: part.value, changed: true })
    } else {
      common += part.value.trim().length
      removed.push({ text: part.value, changed: false })
      added.push({ text: part.value, changed: false })
    }
  }
  const shorter = Math.min(before.trim().length, after.trim().length)
  if (shorter === 0 || common / shorter < WORD_DIFF_MINIMUM) return undefined
  return { removed, added }
}

const plain = (type: DiffRow['type'], line: string): DiffRow => ({
  type,
  segments: [{ text: line, changed: false }],
})

// The rows of a line diff between two versions of a page. A run of removed
// lines followed by a run of added lines is an edit: its lines are paired in
// order, and each pair carries the words that changed. Wiki lines are whole
// paragraphs, so without this a one-word edit marks the paragraph twice and
// leaves the reader to find the word.
export function diffRows(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = []
  const parts = diffLines(before, after)
  const lines = (value: string) => value.replace(/\n$/, '').split('\n')

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const next = parts[i + 1]
    if (part.removed && next?.added) {
      const removed = lines(part.value)
      const added = lines(next.value)
      const pairs = removed.map((line, j) =>
        j < added.length ? wordSegments(line, added[j]) : undefined
      )
      removed.forEach((line, j) =>
        rows.push(
          pairs[j]
            ? { type: 'remove', segments: pairs[j].removed }
            : plain('remove', line)
        )
      )
      added.forEach((line, j) =>
        rows.push(
          pairs[j]
            ? { type: 'add', segments: pairs[j].added }
            : plain('add', line)
        )
      )
      i++
      continue
    }
    const type = part.added ? 'add' : part.removed ? 'remove' : 'context'
    for (const line of lines(part.value)) rows.push(plain(type, line))
  }
  return rows
}
