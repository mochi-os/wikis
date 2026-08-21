// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Refreshes the wiki query tree when P2P sync (initial dump or live broadcast)
// writes to the local DB. The Starlark side emits {"type":"wiki/update"} and
// {"type":"wiki/resynced"} on the wiki's fingerprint.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuthStore,
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from "@mochi/web";

// Subscribe to wiki WebSocket events and refresh wiki content when remote
// data (sync dump or live broadcast) lands locally.
export function useWikiWebsocket(wikiFingerprint?: string) {
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.isInitialized);
  const authToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!authReady) return;
    if (!wikiFingerprint) return;

    const handleMessage = (data: EntityWebsocketEvent) => {
      switch (data.type) {
        case "wiki/update":
        case "wiki/resynced":
          // The whole wiki query tree (pages list, page content, comments,
          // tags, redirects, info) is rooted at ['wiki']; a sync delivers any
          // of these, so refresh the lot. Matches the manual-sync mutation.
          void queryClient.invalidateQueries({ queryKey: ["wiki"] });
          break;
      }
    };

    return entityWebsocketManager.subscribe(wikiFingerprint, handleMessage);
  }, [authReady, authToken, wikiFingerprint, queryClient]);
}
