import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Labels",
  description: "La future cartographie des labels et collectifs de la musique haïtienne.",
};

export default function LabelsPage() {
  return (
    <>
      <SiteHeader />
      <main className="coming-soon-page">
        <section className="coming-soon-panel">
          <span className="coming-soon-kicker">Écosystème HMI</span>
          <h1>Labels & collectifs</h1>
          <p>
            Cette section réunira bientôt les labels, maisons de production et collectifs
            qui structurent la musique haïtienne.
          </p>
          <span className="coming-soon-badge">Bientôt disponible</span>
        </section>
      </main>
    </>
  );
}
