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
