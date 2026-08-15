"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Quitte le solitaire et ramène au menu principal de Planète HMI (« / »),
 * jamais à une page de jeux ou à un historique imprévisible.
 */
export function useExitSolitaire() {
  const router = useRouter();
  return useCallback(() => {
    router.push("/");
  }, [router]);
}
