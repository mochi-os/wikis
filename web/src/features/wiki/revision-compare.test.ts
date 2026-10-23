// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import {
  compareOptions,
  compareOrder,
  defaultCompare,
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
