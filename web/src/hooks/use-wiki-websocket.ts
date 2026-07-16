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
// remote edit never appears. The Starlark side now emits {"type":"wiki/update"}
// (and already emitted {"type":"wiki/resynced"} on resync); here we listen and
// invalidate the wiki query tree so the content refreshes the moment it lands.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@mochi/web";

interface WikiWebsocketEvent {
  type: string;
  wiki?: string;
}

const RECONNECT_DELAY = 3000;

function getWebSocketUrl(key: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const raw = useAuthStore.getState().token;
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : raw;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${protocol}//${window.location.host}/_/websocket?key=${key}${tokenParam}`;
}

// Singleton WebSocket manager to prevent duplicate connections
class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subscribers = new Map<
    string,
    Set<(event: WikiWebsocketEvent) => void>
  >();
  private connectionAttempts = new Map<string, boolean>();

  subscribe(
    key: string,
    callback: (event: WikiWebsocketEvent) => void,
  ): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    this.ensureConnection(key);

    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
          this.closeConnection(key);
        }
      }
    };
  }

  private ensureConnection(key: string) {
    const existing = this.connections.get(key);
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (this.connectionAttempts.get(key)) return;
    this.connect(key);
  }

  private connect(key: string) {
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
    if (!this.subscribers.has(key) || this.subscribers.get(key)!.size === 0) {
      return;
    }

    this.connectionAttempts.set(key, true);

    try {
      const ws = new WebSocket(getWebSocketUrl(key));
      this.connections.set(key, ws);

      ws.onopen = () => {
        this.connectionAttempts.set(key, false);
      };

      ws.onmessage = (event) => {
        try {
          const data: WikiWebsocketEvent = JSON.parse(event.data);
          const subs = this.subscribers.get(key);
          if (subs) {
            subs.forEach((callback) => callback(data));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        this.connectionAttempts.set(key, false);
        this.connections.delete(key);
        if (
          this.subscribers.has(key) &&
          this.subscribers.get(key)!.size > 0
        ) {
          const t = setTimeout(() => this.connect(key), RECONNECT_DELAY);
          this.reconnectTimers.set(key, t);
        }
      };

      ws.onerror = () => {
        this.connectionAttempts.set(key, false);
      };
    } catch {
      this.connectionAttempts.set(key, false);
      if (
        this.subscribers.has(key) &&
        this.subscribers.get(key)!.size > 0
      ) {
        const t = setTimeout(() => this.connect(key), RECONNECT_DELAY);
        this.reconnectTimers.set(key, t);
      }
    }
  }

  private closeConnection(key: string) {
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
    const ws = this.connections.get(key);
    if (ws) {
      ws.close();
      this.connections.delete(key);
    }
    this.connectionAttempts.delete(key);
  }
}

const wsManager = new WebSocketManager();

// Subscribe to wiki WebSocket events and refresh wiki content when remote
// data (sync dump or live broadcast) lands locally.
export function useWikiWebsocket(wikiFingerprint?: string) {
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.isInitialized);
  const authToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!authReady) return;
    if (!wikiFingerprint) return;

    const handleMessage = (data: WikiWebsocketEvent) => {
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

    return wsManager.subscribe(wikiFingerprint, handleMessage);
  }, [authReady, authToken, wikiFingerprint, queryClient]);
}
