// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it, vi } from 'vitest'
import { attachmentAddress } from './attachment-url'

// In the shell's frame authenticatedUrl adds the asset token as a query.
vi.mock('@mochi/web', async () => ({
  ...(await import('@mochi/web/lib/request-path.ts')),
  authenticatedUrl: (url: string) => `${url}?token=asset`,
}))

describe('attachmentAddress', () => {
  it('puts a variant on the path, before the token', () => {
    expect(attachmentAddress('/wikis/w/-/', 'a b', '/thumbnail')).toBe(
      '/wikis/w/-/attachments/a%20b/thumbnail?token=asset'
    )
  })

  it('names the attachment itself with no variant', () => {
    expect(attachmentAddress('/wikis/w/-/', 'x')).toBe(
      '/wikis/w/-/attachments/x?token=asset'
    )
  })

  // A peer's id that is not one segment would aim the image at another
  // action: core routes on the decoded path, so a slash is refused.
  it('has no address for an id that is not one segment', () => {
    for (const id of ['../delete', 'a/thumbnail', '.', '..', '']) {
      expect(attachmentAddress('/wikis/w/-/', id)).toBeUndefined()
    }
  })

  it('keeps a query in an id inside its segment', () => {
    expect(attachmentAddress('/wikis/w/-/', 'x?y=1')).toBe(
      '/wikis/w/-/attachments/x%3Fy%3D1?token=asset'
    )
  })
})
