// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { isDomainEntityRouting } from '@mochi/web'

// A 9-character fingerprint or a 50-51 character entity id.
const ENTITY_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

/**
 * Where the actions of the wiki an address names sit. On a domain route the
 * entity is the host, so its actions sit at /-/. A direct entity URL
 * (/<entity>/<page>) addresses them under the entity; in app context the app
 * path comes first. Read from the window, since the router's location is
 * relative to where the app is mounted.
 */
export function wikiBaseURL(wikiId: string): string {
  const firstSegment = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''
  return isDomainEntityRouting() ||
    (firstSegment === wikiId && !ENTITY_ID_RE.test(wikiId))
    ? `/-/`
    : ENTITY_ID_RE.test(firstSegment)
      ? `/${firstSegment}/-/`
      : `/${firstSegment}/${wikiId}/-/`
}
