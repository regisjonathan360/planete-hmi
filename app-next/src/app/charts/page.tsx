import { getChartOverview } from "@/lib/charts/queries/get-chart-overview";
import { ChartsPageHeader } from "@/components/charts/ChartsPageHeader";
import { PlatformChartRow } from "@/components/charts/PlatformChartRow";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import { HmiShorts } from "@/components/HmiShorts";
import { SOURCE_KEY_PAR_SLUG, dateHaiti } from "@/lib/charts/format";
import type { ChartOverviewRow } from "@/lib/charts/queries/types";

export const dynamic = "force-dynamic";

// Ordre officiel des 5 plateformes.
const ORDRE = ["youtube", "spotify", "audiomack", "apple_music", "tiktok"];

/** Garde une rangée par plateforme (la première rencontrée = source principale). */
function cinqRangees(rows: ChartOverviewRow[]): ChartOverviewRow[] {
  const parPlateforme = new Map<string, ChartOverviewRow>();
  const sourcesPrincipales = new Set(Object.values(SOURCE_KEY_PAR_SLUG));
  for (const platform of ORDRE) {
    const principale = rows.find((row) => row.platform === platform && sourcesPrincipales.has(row.source_key));
    const fallback = rows.find((row) => row.platform === platform);
    if (principale ?? fallback) {
      parPlateforme.set(platform, (principale ?? fallback)!);
    }
  }
  return ORDRE.map((p) => parPlateforme.get(p)).filter((r): r is ChartOverviewRow => !!r);
}

export default async function ChartsPage() {
  let rows: ChartOverviewRow[] = [];
  let erreur = false;
  try {
    rows = await getChartOverview(10);
  } catch {
    erreur = true;
  }

  const rangees = cinqRangees(rows);
  const derniereMaj = rows
    .map((r) => r.published_at)
    .filter(Boolean)
    .sort((a, b) => a!.localeCompare(b!))
    .at(-1);

  return (
    <>
      <ChartsPageHeader publieLe={derniereMaj ? dateHaiti(derniereMaj) : undefined} />
      {erreur ? (
        <ChartEmptyState message="Impossible de charger les classements pour le moment. Réessayez plus tard." />
      ) : (
        rangees.map((row) => <PlatformChartRow key={row.source_key} row={row} />)
      )}
      <HmiShorts />
    </>
  );
}
