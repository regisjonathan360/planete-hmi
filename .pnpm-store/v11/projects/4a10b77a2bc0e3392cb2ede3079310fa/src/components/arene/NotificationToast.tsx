"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./NotificationToast.module.css";

// --- Types ---

export type ToastType = "level_up" | "badge" | "cap_reached" | "info";

export interface NotificationToastProps {
  message: string;
  type?: ToastType;
  onDismiss?: () => void;
  duration?: number; // ms, default 5000
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// --- Constants ---

const TOAST_ICONS: Record<ToastType, { emoji: string; label: string }> = {
  level_up: { emoji: "🚀", label: "Niveau supérieur" },
  badge: { emoji: "🏆", label: "Badge obtenu" },
  cap_reached: { emoji: "⚡", label: "Plafond atteint" },
  info: { emoji: "💫", label: "Information" },
};

const DEFAULT_DURATION = 5000;

// --- NotificationToast Component ---

/**
 * Toast de notification pour les événements de l'arène :
 * - level_up : passage de niveau cosmique
 * - badge : badge obtenu
 * - cap_reached : plafond quotidien de points atteint
 * - info : notification générale
 *
 * Se ferme automatiquement après `duration` ms (défaut 5000).
 * Accessible via role="alert" et aria-live="polite".
 */
export function NotificationToast({
  message,
  type = "info",
  onDismiss,
  duration = DEFAULT_DURATION,
}: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation to complete before calling onDismiss
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(handleDismiss, duration);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, handleDismiss]);

  const { emoji, label } = TOAST_ICONS[type];

  const className = [
    styles.toast,
    styles[type],
    isExiting ? styles.exiting : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        {emoji}
      </span>
      <span className={styles.message}>
        <span className={styles.typeLabel}>{label}</span>
        {message}
      </span>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={handleDismiss}
        aria-label="Fermer la notification"
      >
        ✕
      </button>
    </div>
  );
}

// --- ToastContainer Component ---

/**
 * Conteneur gérant une pile de toasts.
 * Positionné en haut à droite de l'écran.
 * Gère l'ajout et la suppression automatique des toasts.
 */
export function ToastContainer({ toasts, onRemove }: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className={styles.container} aria-label="Notifications" role="region">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

// --- useToastManager hook ---

let toastIdCounter = 0;

/**
 * Hook pour gérer l'état d'une pile de toasts.
 * Retourne l'état et des fonctions pour ajouter/supprimer des toasts.
 *
 * Usage:
 * ```tsx
 * const { toasts, addToast, removeToast } = useToastManager();
 * // ...
 * addToast({ message: "Niveau Constellation atteint !", type: "level_up" });
 * // ...
 * <ToastContainer toasts={toasts} onRemove={removeToast} />
 * ```
 */
export function useToastManager() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (options: { message: string; type?: ToastType; duration?: number }) => {
      const id = `toast-${++toastIdCounter}-${Date.now()}`;
      const newToast: ToastItem = {
        id,
        message: options.message,
        type: options.type ?? "info",
        duration: options.duration ?? DEFAULT_DURATION,
      };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
