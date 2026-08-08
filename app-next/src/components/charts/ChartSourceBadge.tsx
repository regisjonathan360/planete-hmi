import { badgeMethode } from "@/lib/charts/format";

/** Badge de méthode de collecte (ou « Mise à jour en attente » si périmé). */
export function ChartSourceBadge({
  ingestionMode,
  isStale,
}: {
  ingestionMode: string;
  isStale: boolean | null;
}) {
  const { label, variant } = badgeMethode(ingestionMode, isStale);
  return <span className={`mbadge mbadge--${variant}`}>{label}</span>;
}
