"use client";

import dynamic from "next/dynamic";

/**
 * Chargement strictement côté client : le canvas WebGL et la détection du
 * gyroscope n'ont aucun sens pendant le rendu serveur.
 */
export const HaitiGlobe = dynamic(
  () => import("./HaitiGlobe").then((m) => m.HaitiGlobe),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ width: "100%", height: "min(880px, 88vh)" }}
        aria-label="Chargement de la planète Haïti"
      />
    ),
  },
);
