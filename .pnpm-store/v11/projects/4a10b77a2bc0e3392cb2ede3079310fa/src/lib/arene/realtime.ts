"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const MAX_SUBSCRIPTIONS = 5;
const RECONNECT_INTERVAL_MS = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Gestionnaire de souscriptions Realtime pour l'Arène.
 * Garantit un maximum de 5 souscriptions simultanées (éviction LRU).
 * Logique de reconnexion automatique : 5s d'intervalle, max 5 tentatives.
 * Nettoyage automatique lors de la navigation (via useEffect cleanup).
 *
 * Requirements: 13.1, 13.2, 13.6
 */
export class AreneRealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  /** Tracks access order for LRU eviction. Most recent access is at the end. */
  private accessOrder: string[] = [];
  private supabase: SupabaseClient;
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _connectionStatus: "connected" | "disconnected" | "reconnecting" =
    "connected";
  private statusListeners: Set<() => void> = new Set();

  constructor() {
    this.supabase = createClient();
  }

  /** Current connection status. */
  get connectionStatus() {
    return this._connectionStatus;
  }

  /** Register a listener called when connectionStatus changes. Returns unsubscribe fn. */
  onStatusChange(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribe to Postgres changes on a table via Supabase Realtime.
   * If max subscriptions (5) are already active, evicts the least-recently-used channel.
   *
   * @returns An unsubscribe function to call when the subscription is no longer needed.
   */
  subscribe(
    channelName: string,
    table: string,
    filter: string,
    callback: (payload: unknown) => void
  ): () => void {
    // If already subscribed to this channel, refresh LRU order and return existing unsub
    if (this.channels.has(channelName)) {
      this.touchAccessOrder(channelName);
      return () => this.unsubscribe(channelName);
    }

    // Evict LRU channel if at capacity
    if (this.channels.size >= MAX_SUBSCRIPTIONS) {
      const lru = this.accessOrder[0];
      if (lru) {
        this.unsubscribe(lru);
      }
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        callback
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          this.handleDisconnect(channelName, table, filter, callback);
        }
        if (status === "SUBSCRIBED") {
          // Successful subscription — reset reconnect counter for this channel
          this.reconnectAttempts.set(channelName, 0);
          this.setConnectionStatus("connected");
        }
      });

    this.channels.set(channelName, channel);
    this.pushAccessOrder(channelName);

    return () => this.unsubscribe(channelName);
  }

  /**
   * Manually remove a specific subscription.
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
    this.removeFromAccessOrder(channelName);
    this.clearReconnectTimer(channelName);
    this.reconnectAttempts.delete(channelName);
  }

  /**
   * Cleanup all subscriptions. Call on navigation away or component unmount.
   * Resets all internal state.
   */
  cleanup(): void {
    // Clear all reconnect timers first
    for (const [name] of this.reconnectTimers) {
      this.clearReconnectTimer(name);
    }

    // Remove all channels
    for (const [, channel] of this.channels) {
      this.supabase.removeChannel(channel);
    }

    this.channels.clear();
    this.accessOrder = [];
    this.reconnectAttempts.clear();
    this.reconnectTimers.clear();
    this.setConnectionStatus("connected");
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private handleDisconnect(
    channelName: string,
    table: string,
    filter: string,
    callback: (payload: unknown) => void
  ): void {
    const attempts = this.reconnectAttempts.get(channelName) ?? 0;

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setConnectionStatus("disconnected");
      return;
    }

    this.setConnectionStatus("reconnecting");
    this.reconnectAttempts.set(channelName, attempts + 1);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(channelName);
      // Remove the failed channel before re-subscribing
      const existingChannel = this.channels.get(channelName);
      if (existingChannel) {
        this.supabase.removeChannel(existingChannel);
        this.channels.delete(channelName);
      }
      this.removeFromAccessOrder(channelName);
      // Re-subscribe (this will push to access order again)
      this.subscribe(channelName, table, filter, callback);
    }, RECONNECT_INTERVAL_MS);

    this.reconnectTimers.set(channelName, timer);
  }

  private setConnectionStatus(
    status: "connected" | "disconnected" | "reconnecting"
  ): void {
    if (this._connectionStatus !== status) {
      this._connectionStatus = status;
      for (const listener of this.statusListeners) {
        listener();
      }
    }
  }

  private pushAccessOrder(channelName: string): void {
    this.removeFromAccessOrder(channelName);
    this.accessOrder.push(channelName);
  }

  private touchAccessOrder(channelName: string): void {
    this.removeFromAccessOrder(channelName);
    this.accessOrder.push(channelName);
  }

  private removeFromAccessOrder(channelName: string): void {
    const idx = this.accessOrder.indexOf(channelName);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  private clearReconnectTimer(channelName: string): void {
    const timer = this.reconnectTimers.get(channelName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(channelName);
    }
  }
}
