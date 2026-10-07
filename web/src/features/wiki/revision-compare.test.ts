// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import {
  compareOptions,
  compareOrder,
  defaultCompare,
  pageDiff,
  pageWords,
} from './revision-compare'

// A page made at version 1, deleted at 2, restored at 3 and edited at 4. The
// delete took a number and saved no revision.
const restored = [4, 3, 1]

describe('compareOptions', () => {
  it('lists every other version, newest first', () => {
    expect(compareOptions(3, [1, 2, 3, 4, 5])).toEqual([5, 4, 2, 1])
  })

  it('leaves out a number the page has no revision for', () => {
    expect(compareOptions(4, restored)).toEqual([3, 1])
  })

  it('is empty for a page with one version', () => {
    expect(compareOptions(1, [1])).toEqual([])
  })
})

describe('defaultCompare', () => {
  it('opens on the version before', () => {
    expect(defaultCompare(4, [5, 4, 3, 2, 1])).toBe(3)
  })

  it('opens the oldest version on the version after', () => {
    expect(defaultCompare(1, [5, 4, 3, 2, 1])).toBe(2)
  })

  it('steps over a number the page has no revision for', () => {
    expect(defaultCompare(3, restored)).toBe(1)
    expect(defaultCompare(1, restored)).toBe(3)
  })

  it('has nothing to open on for a single version', () => {
    expect(defaultCompare(1, [1])).toBe(0)
  })

  it('has nothing to open on before the versions are known', () => {
    expect(defaultCompare(3, [])).toBe(0)
  })
})

describe('compareOrder', () => {
  it('reads from the older version to the newer one', () => {
    expect(compareOrder(5, 2)).toEqual({ from: 2, to: 5 })
    expect(compareOrder(2, 5)).toEqual({ from: 2, to: 5 })
  })
})

describe('pageDiff', () => {
  const lines = (before: string, after: string) =>
    pageDiff(before, after)?.hunks.flatMap((hunk) =>
      hunk.lines
        .filter((line) => line.type !== 'header')
        .map((line) => [line.type, line.content])
    )

  it('keeps the whole page as context around a change', () => {
    const page = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
    const edited = [...page]
    edited[14] = 'changed'
    const file = pageDiff(page.join('\n') + '\n', edited.join('\n') + '\n')
    expect(file?.hunks).toHaveLength(1)
    expect(file?.additions).toBe(1)
    expect(file?.deletions).toBe(1)
    // 29 unchanged lines, one removed and one added.
    expect(
      lines(page.join('\n') + '\n', edited.join('\n') + '\n')
    ).toHaveLength(31)
  })

  it('numbers the lines of each side', () => {
    const file = pageDiff('one\ntwo\n', 'one\n2\nthree\n')
    const rows = file?.hunks[0].lines.filter((line) => line.type !== 'header')
    expect(rows).toEqual([
      { type: 'context', content: 'one', oldNum: 1, newNum: 1 },
      { type: 'remove', content: 'two', oldNum: 2 },
      { type: 'add', content: '2', newNum: 2 },
      { type: 'add', content: 'three', newNum: 3 },
    ])
  })

  it('reads page text that looks like diff markup as plain lines', () => {
    const before =
      'diff --git a/x b/x\n--- a rule\n# diff truncated: 3 more files\n'
    expect(lines(before, before + 'new\n')).toEqual([
      ['context', 'diff --git a/x b/x'],
      ['context', '--- a rule'],
      ['context', '# diff truncated: 3 more files'],
      ['add', 'new'],
    ])
  })

  it('keeps blank lines', () => {
    expect(lines('a\n\nb\n', 'a\n\nc\n')).toEqual([
      ['context', 'a'],
      ['context', ''],
      ['remove', 'b'],
      ['add', 'c'],
    ])
  })

  it('has nothing to show for two versions with the same text', () => {
    expect(pageDiff('same\n', 'same\n')).toBeUndefined()
  })
})

describe('pageWords', () => {
  const side = (
    changes: ReturnType<typeof pageWords>,
    drop: 'added' | 'removed'
  ) =>
    changes
      ?.filter((change) => !change[drop])
      .map((change) => change.value)
      .join('')

  it('marks only the words that changed in an edited line', () => {
    const changes = pageWords(
      'Mochi runs on a single server.',
      'Mochi runs on a small server.'
    )
    expect(changes?.filter((c) => c.removed).map((c) => c.value)).toEqual([
      'single',
    ])
    expect(changes?.filter((c) => c.added).map((c) => c.value)).toEqual([
      'small',
    ])
  })

  it('rebuilds each side exactly, spacing included', () => {
    const before = 'One  two   three four five'
    const after = 'One  two   3 four five'
    const changes = pageWords(before, after)
    expect(side(changes, 'added')).toBe(before)
    expect(side(changes, 'removed')).toBe(after)
  })

  it('declines two lines with little in common', () => {
    expect(
      pageWords('Install from git.', 'Requirements are listed below.')
    ).toBeUndefined()
  })
})
