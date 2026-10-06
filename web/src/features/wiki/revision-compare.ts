// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
