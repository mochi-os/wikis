// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { authenticatedUrl, path, tryPath } from '@mochi/web'

/**
 * A wiki attachment's address, or one of its variants ('/thumbnail'). The
 * variant goes on before the token authenticatedUrl adds in the shell's
 * frame: appended after it, the variant's path ended up inside the token's
 * value, so the page asked for the full image with a token that could not
 * verify. The id can be a peer's, so it goes in through path; one that is not
 * a single segment has no address, and the caller leaves the image out.
 */
export function attachmentAddress(
  baseURL: string,
  id: string,
  variant: '' | '/thumbnail' | '/preview' = ''
): string | undefined {
  const attachment = tryPath(() => path`attachments/${id}`)
  if (attachment === undefined) return undefined
  return authenticatedUrl(`${baseURL}${attachment}${variant}`)
}
