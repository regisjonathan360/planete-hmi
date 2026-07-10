"use client";

import dynamic from "next/dynamic";

const StageLightsBackground = dynamic(
  () => import("./StageLightsBackground").then((m) => m.StageLightsBackground),
  { ssr: false }
);

export function StageLightsLoader() {
  return <StageLightsBackground />;
}
