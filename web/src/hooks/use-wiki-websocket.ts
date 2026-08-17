// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// WebSocket hook for real-time wiki updates.
//
// Incoming P2P sync (the initial dump applied by import_sync_dump, and live
// page/comment/tag broadcasts applied by the event_* handlers) writes straight
// to the local DB. Without a notification the open UI keeps showing stale data
// until the next manual reload — a freshly-subscribed wiki looks empty, and a
// remote edit never appears. The Starlark side emits {"type":"wiki/update"}
// (and {"type":"wiki/resynced"} on resync); here we listen and invalidate the
// wiki query tree so the content refreshes the moment it lands.

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
