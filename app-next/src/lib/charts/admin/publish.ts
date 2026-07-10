/**
 * Publication contrôlée d'une édition Audiomack (et futures plateformes).
 *
 * - publishEdition   : fige la version publique dans chart_published_snapshots.
 * - restoreLastPublished : ré-applique l'état admin figé (annule les modifs).
 * - cancelChanges    : réinitialise les overrides admin sur l'ordre source.
 *
 * Le site public lit uniquement chart_published_snapshots : tant que
 * l'admin ne publie pas, ses modifications restent invisibles.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeAdminEdition } from "./recompute-admin-edition";
import { getAdminChartData } from "./queries";

interface SnapshotEntry {
  filtered_position: number;
  source_position: number;
  movement: number | null;
  entry_status: string;
  metric_value: number | null;
  metric_unit: string | null;
  track_id: string | null;
  track_title: string;
  artists_text: string | null;
  artwork_url: string | null;
  platform_url: string | null;
  peak_filtered_position: number;
  weeks_on_chart: number;
}

interface EditableStateEntry {
  trackId: string | null;
  sourcePosition: number;
  adminPosition: number | null;
  isHidden: boolean;
  isExcluded: boolean;
  exclusionReason: string | null;
  displayTitle: string | null;
  displayArtist: string | null;
  displayArtworkUrl: string | null;
  displayUrl: string | null;
}

export interface PublishResult {
  editionId: string;
  publishedEntries: number;
  message: string;
}

/**
 * Publie l'édition de travail d'une source : recalcule, fige le snapshot
 * public (seules les entrées validées haïtiennes visibles apparaissent).
 */
export async function publishEdition(
  supabase: SupabaseClient,
  sourceKey: string,
  options: { changedBy?: string | null } = {}
): Promise<PublishResult> {
  const data = await getAdminChartData(supabase, sourceKey);
  if (!data.edition) throw new Error("Aucune édition de travail à publier.");

  const editionId = data.edition.editionId;

  // Recalcul admin (ordre + renumérotation des visibles).
  await recomputeAdminEdition(supabase, editionId, {
    action: "publish",
    changedBy: options.changedBy,
  });

  // Recharger après recalcul pour des positions fraîches.
  const fresh = await getAdminChartData(supabase, sourceKey);

  // Entrées publiques = visibles + éligibles (artiste haïtien validé).
  // Pour TikTok, les sons sont validés manuellement dans la validation queue,
  // donc toutes les entrées non masquées/exclues sont éligibles.
  const isTikTok = sourceKey.startsWith("tiktok_");
  const publicSource = fresh.entries
    .filter((e) => !e.isHidden && !e.isExcluded && (isTikTok || e.isEligible))
    .sort((a, b) => {
      const pa = a.filteredPosition ?? a.sourcePosition;
      const pb = b.filteredPosition ?? b.sourcePosition;
      return pa - pb;
    });

  // Snapshot précédent pour mouvements / historique.
  const { data: prevSnap } = await supabase
    .from("chart_published_snapshots")
    .select("payload")
    .eq("source_key", sourceKey)
    .maybeSingle();
  const prevEntries: SnapshotEntry[] =
    (prevSnap?.payload as { entries?: SnapshotEntry[] } | null)?.entries ?? [];
  const prevByTrack = new Map<string, SnapshotEntry>();
  prevEntries.forEach((e) => {
    if (e.track_id) prevByTrack.set(e.track_id, e);
  });

  const publicEntries: SnapshotEntry[] = publicSource.map((e, index) => {
    const newPos = index + 1;
    const prev = e.trackId ? prevByTrack.get(e.trackId) : undefined;
    let movement: number | null = null;
    let entryStatus = "new";
    let peak = newPos;
    let weeks = 1;

    if (prev) {
      movement = prev.filtered_position - newPos;
      entryStatus = movement > 0 ? "up" : movement < 0 ? "down" : "stable";
      peak = Math.min(prev.peak_filtered_position ?? newPos, newPos);
      weeks = (prev.weeks_on_chart ?? 1) + 1;
    }

    return {
      filtered_position: newPos,
      source_position: e.sourcePosition,
      movement,
      entry_status: entryStatus,
      metric_value: null,
      metric_unit: "source_rank",
      track_id: e.trackId,
      track_title: e.title,
      artists_text: e.artist,
      artwork_url: e.artworkUrl,
      platform_url: e.audiomackUrl,
      peak_filtered_position: peak,
      weeks_on_chart: weeks,
    };
  });

  const payload = {
    source_key: data.edition.sourceKey,
    platform: data.edition.platform,
    display_name: data.edition.displayName,
    chart_context: "Weekly 100: Haiti officiel Audiomack",
    market_code: "HT",
    ingestion_mode: "OFFICIAL_EXPORT",
    is_automatic: true,
    edition: {
      edition_id: editionId,
      period_start: data.edition.periodStart,
      period_end: data.edition.periodEnd,
      published_at: new Date().toISOString(),
      source_updated_at: data.edition.sourceUpdatedAt,
      is_stale: false,
      entry_count: publicEntries.length,
    },
    entries: publicEntries,
  };

  // État admin figé, pour « Restaurer ».
  const editableState: EditableStateEntry[] = fresh.entries.map((e) => ({
    trackId: e.trackId,
    sourcePosition: e.sourcePosition,
    adminPosition: e.adminPosition,
    isHidden: e.isHidden,
    isExcluded: e.isExcluded,
    exclusionReason: e.exclusionReason,
    displayTitle: e.displayTitle,
    displayArtist: e.displayArtist,
    displayArtworkUrl: e.displayArtworkUrl,
    displayUrl: e.displayUrl,
  }));

  const now = new Date().toISOString();

  const { error: snapErr } = await supabase
    .from("chart_published_snapshots")
    .upsert(
      {
        chart_source_id: data.edition.sourceId,
        source_key: sourceKey,
        edition_id: editionId,
        platform: data.edition.platform,
        period_start: data.edition.periodStart,
        period_end: data.edition.periodEnd,
        is_stale: false,
        payload,
        editable_state: editableState,
        published_at: now,
      },
      { onConflict: "source_key" }
    );
  if (snapErr) throw new Error(`Publication du snapshot échouée: ${snapErr.message}`);

  // Statut "ready" (et NON "published") : la version publique vit uniquement
  // dans chart_published_snapshots. Ainsi les modifications ultérieures sur
  // chart_entries restent en brouillon et n'affectent pas le site public
  // tant qu'une nouvelle publication ne régénère pas le snapshot.
  await supabase
    .from("chart_editions")
    .update({
      status: "ready",
      published_at: now,
      last_published_at: now,
      validated_at: now,
      has_unpublished_changes: false,
      entry_count: publicEntries.length,
      is_stale: false,
    })
    .eq("id", editionId);

  await supabase.from("chart_entry_history").insert({
    chart_edition_id: editionId,
    action: "publish",
    source: data.edition.platform,
    is_manual: true,
    note: `${publicEntries.length} entrées publiées.`,
    changed_by: options.changedBy ?? null,
  });

  return {
    editionId,
    publishedEntries: publicEntries.length,
    message: `Classement publié : ${publicEntries.length} entrée(s) visible(s) sur le site public.`,
  };
}

/**
 * Restaure l'état admin de la dernière version publiée (annule les modifs
 * non publiées de l'édition courante).
 */
export async function restoreLastPublished(
  supabase: SupabaseClient,
  sourceKey: string,
  options: { changedBy?: string | null } = {}
): Promise<{ restored: number }> {
  const { data: snap } = await supabase
    .from("chart_published_snapshots")
    .select("edition_id, editable_state")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (!snap?.editable_state) {
    throw new Error("Aucune version publiée à restaurer.");
  }

  const editionId = snap.edition_id as string;
  const state = snap.editable_state as EditableStateEntry[];
  const byTrack = new Map<string, EditableStateEntry>();
  state.forEach((s) => {
    if (s.trackId) byTrack.set(s.trackId, s);
  });

  const { data: entries } = await supabase
    .from("chart_entries")
    .select("id, track_id")
    .eq("chart_edition_id", editionId);

  let restored = 0;
  for (const entry of entries ?? []) {
    const target = entry.track_id ? byTrack.get(entry.track_id as string) : undefined;
    if (!target) continue;
    await supabase
      .from("chart_entries")
      .update({
        admin_position: target.adminPosition,
        is_hidden: target.isHidden,
        is_excluded: target.isExcluded,
        exclusion_reason: target.exclusionReason,
        display_title: target.displayTitle,
        display_artist: target.displayArtist,
        display_artwork_url: target.displayArtworkUrl,
        display_url: target.displayUrl,
      })
      .eq("id", entry.id);
    restored++;
  }

  await recomputeAdminEdition(supabase, editionId, {
    action: "restore",
    changedBy: options.changedBy,
  });

  await supabase
    .from("chart_editions")
    .update({ has_unpublished_changes: false })
    .eq("id", editionId);

  return { restored };
}

/**
 * Annule tous les overrides admin : revient à l'ordre source Audiomack brut.
 */
export async function cancelChanges(
  supabase: SupabaseClient,
  sourceKey: string,
  options: { changedBy?: string | null } = {}
): Promise<{ reset: number }> {
  const data = await getAdminChartData(supabase, sourceKey);
  if (!data.edition) throw new Error("Aucune édition de travail.");
  const editionId = data.edition.editionId;

  const { data: entries } = await supabase
    .from("chart_entries")
    .select("id")
    .eq("chart_edition_id", editionId);

  let reset = 0;
  for (const entry of entries ?? []) {
    await supabase
      .from("chart_entries")
      .update({
        admin_position: null,
        is_hidden: false,
        is_excluded: false,
        exclusion_reason: null,
        display_title: null,
        display_artist: null,
        display_artwork_url: null,
        display_url: null,
      })
      .eq("id", entry.id);
    reset++;
  }

  await recomputeAdminEdition(supabase, editionId, {
    action: "cancel",
    changedBy: options.changedBy,
  });

  return { reset };
}
