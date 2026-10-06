// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import {
  compareOptions,
  compareOrder,
  defaultCompare,
  diffRows,
} from './revision-compare'

describe('compareOptions', () => {
  it('lists every other version, newest first', () => {
    expect(compareOptions(3, 5)).toEqual([5, 4, 2, 1])
  })

  it('is empty for a page with one version', () => {
    expect(compareOptions(1, 1)).toEqual([])
  })
})

describe('defaultCompare', () => {
  it('opens on the version before', () => {
    expect(defaultCompare(4, 9)).toBe(3)
  })

  it('opens version 1 on the version after', () => {
    expect(defaultCompare(1, 9)).toBe(2)
  })

  it('has nothing to open on for a single version', () => {
    expect(defaultCompare(1, 1)).toBe(0)
  })
})

describe('compareOrder', () => {
  it('reads from the older version to the newer one', () => {
    expect(compareOrder(5, 2)).toEqual({ from: 2, to: 5 })
    expect(compareOrder(2, 5)).toEqual({ from: 2, to: 5 })
  })
})

describe('diffRows', () => {
  const text = (segments: { text: string }[]) =>
    segments.map((s) => s.text).join('')
  const changed = (segments: { text: string; changed: boolean }[]) =>
    segments.filter((s) => s.changed).map((s) => s.text)

  it('marks only the words that changed in an edited line', () => {
    const rows = diffRows(
      'Mochi runs on a single server.\n',
      'Mochi runs on a small server.\n'
    )
    expect(rows.map((r) => r.type)).toEqual(['remove', 'add'])
    expect(changed(rows[0].segments)).toEqual(['single'])
    expect(changed(rows[1].segments)).toEqual(['small'])
  })

  it('rebuilds each side exactly, spacing included', () => {
    const before = 'One  two   three four five'
    const after = 'One  two   3 four five'
    const rows = diffRows(before + '\n', after + '\n')
    expect(text(rows[0].segments)).toBe(before)
    expect(text(rows[1].segments)).toBe(after)
  })

  it('leaves unrelated lines unmarked', () => {
    const rows = diffRows(
      'Install from git.\n',
      'Requirements are listed below.\n'
    )
    expect(rows.map((r) => r.type)).toEqual(['remove', 'add'])
    expect(changed(rows[0].segments)).toEqual([])
    expect(changed(rows[1].segments)).toEqual([])
  })

  it('keeps unchanged lines as context and plain additions whole', () => {
    const rows = diffRows('First\n', 'First\nSecond\n')
    expect(rows).toEqual([
      { type: 'context', segments: [{ text: 'First', changed: false }] },
      { type: 'add', segments: [{ text: 'Second', changed: false }] },
    ])
  })

  it('pairs lines in order and leaves the extra ones whole', () => {
    const rows = diffRows(
      'The quick brown fox\n',
      'The quick red fox\nA new closing line\n'
    )
    expect(rows.map((r) => r.type)).toEqual(['remove', 'add', 'add'])
    expect(changed(rows[1].segments)).toEqual(['red'])
    expect(changed(rows[2].segments)).toEqual([])
  })
})
