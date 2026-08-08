import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminChartData } from "@/lib/charts/admin/queries";
import { AdminHeader } from "../AdminHeader";
import { AudiomackManager } from "./AudiomackManager";
import { AudiomackMultiChartPanel } from "@/components/admin/AudiomackMultiChartPanel";
import type { GenreConfig } from "@/components/admin/GenreConfigPanel";

export const dynamic = "force-dynamic";

const SOURCE_KEY = "audiomack_haiti_weekly100";

async function getGenreConfigs(supabase: ReturnType<typeof createAdminClient>): Promise<GenreConfig[]> {
  const { data } = await supabase
    .from("chart_sources")
    .select("source_key, genre_id, display_name, is_enabled, is_automatic, weight, display_order, is_composite_source")
    .eq("platform", "audiomack")
    .eq("is_composite_source", false)
    .order("display_order", { ascending: true });

  if (!data) return [];

  // For each genre, get latest edition info
  const configs: GenreConfig[] = [];
  for (const src of data) {
    // Fetch latest edition for this source
    const { data: editions } = await supabase
      .from("chart_editions")
      .select("id, status, collected_at, entry_count")
      .eq("chart_source_id", src.source_key)
      .order("period_end", { ascending: false })
      .limit(1);

    // Try to get the edition using source_key via chart_sources id lookup
    let lastCollectedAt: string | null = null;
    let currentEditionStatus: GenreConfig["currentEditionStatus"] = null;
    let entryCount = 0;

    // Get the source id first
    const { data: srcRow } = await supabase
      .from("chart_sources")
      .select("id")
      .eq("source_key", src.source_key)
      .single();

    if (srcRow) {
      const { data: ed } = await supabase
        .from("chart_editions")
        .select("id, status, collected_at, entry_count")
        .eq("chart_source_id", srcRow.id)
        .order("period_end", { ascending: false })
        .limit(1);

      if (ed && ed.length > 0) {
        lastCollectedAt = ed[0].collected_at;
        currentEditionStatus = ed[0].status as GenreConfig["currentEditionStatus"];
        entryCount = ed[0].entry_count ?? 0;
      }
    }

    configs.push({
      sourceKey: src.source_key,
      genreId: src.genre_id,
      genreLabel: src.display_name,
      isEnabled: src.is_enabled ?? true,
      isAutomatic: src.is_automatic ?? false,
      weight: src.weight ?? 1.0,
      displayOrder: src.display_order ?? 0,
      lastCollectedAt,
      currentEditionStatus,
      entryCount,
    });
  }

  return configs;
}

export default async function AudiomackAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/audiomack");

  const supabase = createAdminClient();
  let data;
  let loadError: string | null = null;
  let genreConfigs: GenreConfig[] = [];

  try {
    data = await getAdminChartData(supabase, SOURCE_KEY);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Erreur de chargement.";
  }

  try {
    genreConfigs = await getGenreConfigs(supabase);
  } catch {
    // Non-blocking: panel will just be empty
  }

  return (
    <>
      <AdminHeader email={user.email} active="audiomack" />
      <main className="admin__main">
        <h1 className="admin__title">Audiomack — Weekly 100 Haiti</h1>
        <p className="admin__subtitle">
          Contrôle complet du classement : collecte, validation haïtienne, édition manuelle,
          recalcul automatique et publication.
        </p>

        {loadError ? (
          <div className="banner">Impossible de charger les données : {loadError}</div>
        ) : (
          <AudiomackManager sourceKey={SOURCE_KEY} initialData={data!} />
        )}

        {/* Multi-chart panel: genre config, composite, stats, reclassification */}
        <AudiomackMultiChartPanel genres={genreConfigs} />
      </main>
    </>
  );
}
