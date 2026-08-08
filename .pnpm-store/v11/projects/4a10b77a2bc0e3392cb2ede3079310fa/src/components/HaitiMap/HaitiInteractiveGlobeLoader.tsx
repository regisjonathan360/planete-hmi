"use client";

import dynamic from "next/dynamic";

/**
 * Chargement strictement côté client du globe interactif (WebGL + raycasting).
 */
export const HaitiInteractiveGlobe = dynamic(
  () =>
    import("./HaitiInteractiveGlobe").then((m) => m.HaitiInteractiveGlobe),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ width: "100%", height: "min(880px, 88vh)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9ac0" }}
        aria-label="Chargement du globe interactif"
      >
        Chargement du globe...
      </div>
    ),
  },
);
