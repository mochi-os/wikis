// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Every version this one can be compared with, newest first. `versions` is the
// versions the page has a revision for. They cannot be counted from 1:
// deleting a page takes a version number and saves no revision, so a page that
// was deleted and restored skips one.
export function compareOptions(version: number, versions: number[]): number[] {
  return versions.filter((v) => v !== version).sort((a, b) => b - a)
}

// The version a comparison opens on: the nearest one before, which is the
// change this version made. The oldest version has none, so it opens on the
// nearest one after. 0 when the page has no other version to compare with.
export function defaultCompare(version: number, versions: number[]): number {
  let before = 0
  let after = 0
  for (const v of versions) {
    if (v < version && v > before) before = v
    if (v > version && (after === 0 || v < after)) after = v
  }
  return before || after
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
