"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AreneRealtimeManager } from "@/lib/arene/realtime";

/**
 * Contexte Realtime pour l'arène.
 * Wraps AreneRealtimeManager pour exposer subscribe() et connectionStatus
 * aux composants enfants via useRealtime().
 *
 * Requirements: 9.6, 13.1, 13.2, 13.6
 */
interface RealtimeContextValue {
  subscribe: (
    channel: string,
    event: string,
    callback: (payload: unknown) => void
  ) => () => void;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
}

const RealtimeContext = createContext<RealtimeContextValue>({
  subscribe: () => () => {},
  connectionStatus: "connected",
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<AreneRealtimeManager | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("connected");

  // Create manager instance on mount
  useEffect(() => {
    const manager = new AreneRealtimeManager();
    managerRef.current = manager;

    // Track connection status changes from the manager
    const unsubStatus = manager.onStatusChange(() => {
      setConnectionStatus(manager.connectionStatus);
    });

    // Cleanup on unmount
    return () => {
      unsubStatus();
      manager.cleanup();
      managerRef.current = null;
    };
  }, []);

  // Expose subscribe() that delegates to the manager.
  // The context API uses (channel, tableOrEvent, callback) for consumer compatibility.
  // Internally delegates to AreneRealtimeManager.subscribe(channel, table, filter, callback).
  const subscribe = useCallback(
    (
      channel: string,
      tableOrEvent: string,
      callback: (payload: unknown) => void
    ): (() => void) => {
      if (!managerRef.current) {
        return () => {};
      }
      // Use the tableOrEvent as the table name and empty filter for broad subscription
      return managerRef.current.subscribe(channel, tableOrEvent, "", callback);
    },
    []
  );

  const value: RealtimeContextValue = {
    subscribe,
    connectionStatus,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {connectionStatus === "disconnected" && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 rounded-lg bg-red-900/90 px-4 py-2 text-sm text-white shadow-lg"
        >
          Mises à jour en temps réel interrompues. Reconnexion en cours…
        </div>
      )}
      {connectionStatus === "reconnecting" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 rounded-lg bg-yellow-900/90 px-4 py-2 text-sm text-white shadow-lg"
        >
          Reconnexion en cours…
        </div>
      )}
    </RealtimeContext.Provider>
  );
}
