// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Refreshes the wiki query tree when P2P sync (initial dump or live broadcast)
// writes to the local DB. The Starlark side emits {"type":"wiki/update"} and
// {"type":"wiki/resynced"} on the wiki's fingerprint.

import { useEntityInvalidationWebsocket } from "@mochi/web";

const WIKI_EVENT_TYPES = ["wiki/update", "wiki/resynced"];
const WIKI_QUERY_KEY = ["wiki"];

// Subscribe to wiki WebSocket events and refresh wiki content when remote
// data (sync dump or live broadcast) lands locally.
export function useWikiWebsocket(wikiFingerprint?: string) {
  useEntityInvalidationWebsocket({
    fingerprint: wikiFingerprint,
    eventTypes: WIKI_EVENT_TYPES,
    queryKey: WIKI_QUERY_KEY,
  });
}
