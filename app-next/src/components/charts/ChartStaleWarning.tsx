import { dateHaiti } from "@/lib/charts/format";

/** Avertissement d'édition périmée : conserve la dernière édition valide. */
export function ChartStaleWarning({ sourceUpdatedAt }: { sourceUpdatedAt: string | null }) {
  return (
    <p className="stale" role="status">
      ⏳ Mise à jour en attente — dernière édition valide affichée
      {sourceUpdatedAt ? ` (source du ${dateHaiti(sourceUpdatedAt)})` : ""}.
    </p>
  );
}
