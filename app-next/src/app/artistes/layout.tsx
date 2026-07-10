import "./artistes.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artistes — Planète HMI",
  description: "La galaxie des artistes haïtiens vérifiés de Planète HMI.",
};

export default function ArtistesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
