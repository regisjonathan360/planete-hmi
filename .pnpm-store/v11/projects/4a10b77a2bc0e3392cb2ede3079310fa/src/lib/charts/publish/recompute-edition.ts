import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUTS_HAITIENS_VERIFIES } from "../types";
import { calculerPositionsFiltrees } from "../ranking/calculate-filtered-positions";
import { calculerMouvement } from "../ranking/calculate-movement";
import { calculerHistorique } from "../ranking/calculate-chart-history";

interface EntreeDb {
  id: string;
  track_id: string | null;
  source_position: number;
}

/**
 * Recalcule positions filtrées, mouvements et historique d'une édition, puis
 * met à jour chart_entries et entry_count. Réutilise les fonctions pures.
 */
export async function recomputeEdition(
  supabase: SupabaseClient,
  editionId: string
): Promise<{ eligibles: number }> {
  const { data: edition } = await supabase
    .from("chart_editions")
    .select("id, chart_source_id, period_start")
    .eq("id", editionId)
    .single();
  if (!edition) throw new Error("Édition introuvable.");

  const { data: entries } = await supabase
    .from("chart_entries")
    .select("id, track_id, source_position")
    .eq("chart_edition_id", editionId);
  const listeEntrees = (entries ?? []) as EntreeDb[];
  const trackIds = listeEntrees.map((e) => e.track_id).filter((t): t is string => !!t);

  // Éligibilité : au moins un primary/co_primary haïtien vérifié.
  const eligibleParTrack = new Map<string, boolean>();
  if (trackIds.length) {
    const { data: credits } = await supabase
      .from("track_artists")
      .select("track_id, role, artists(haitian_status)")
      .in("track_id", trackIds)
      .in("role", ["primary", "co_primary"]);
    (credits ?? []).forEach((c: unknown) => {
      const row = c as { track_id: string; artists: { haitian_status: string } | null };
      const ok = !!row.artists && STATUTS_HAITIENS_VERIFIES.includes(row.artists.haitian_status as never);
      if (ok) eligibleParTrack.set(row.track_id, true);
    });
  }

  // Positions filtrées.
  const filtrees = calculerPositionsFiltrees(
    listeEntrees.map((e) => ({
      sourcePosition: e.source_position,
      eligible: !!(e.track_id && eligibleParTrack.get(e.track_id)),
      data: e,
    }))
  );
  const posParEntry = new Map<string, number>();
  filtrees.forEach((f) => posParEntry.set((f.data as EntreeDb).id, f.filteredPosition));

  // Historique publié du même classement (éditions antérieures).
  const { data: prevEditions } = await supabase
    .from("chart_editions")
    .select("id, period_start")
    .eq("chart_source_id", edition.chart_source_id)
    .eq("status", "published")
    .lt("period_start", edition.period_start)
    .order("period_start", { ascending: true });
  const historiqueEditions = (prevEditions ?? []) as { id: string; period_start: string }[];

  // Positions passées par track.
  const histParTrack = new Map<string, (number | null)[]>();
  let prevPositions = new Map<string, number>(); // édition précédente immédiate
  if (historiqueEditions.length) {
    const ids = historiqueEditions.map((e) => e.id);
    const { data: prevEntries } = await supabase
      .from("chart_entries")
      .select("chart_edition_id, track_id, filtered_position")
      .in("chart_edition_id", ids);
    const parEdition = new Map<string, Map<string, number>>();
    (prevEntries ?? []).forEach((pe: unknown) => {
      const row = pe as { chart_edition_id: string; track_id: string | null; filtered_position: number | null };
      if (!row.track_id || row.filtered_position == null) return;
      if (!parEdition.has(row.chart_edition_id)) parEdition.set(row.chart_edition_id, new Map());
      parEdition.get(row.chart_edition_id)!.set(row.track_id, row.filtered_position);
    });
    historiqueEditions.forEach((ed) => {
      const m = parEdition.get(ed.id) ?? new Map<string, number>();
      trackIds.forEach((t) => {
        const arr = histParTrack.get(t) ?? [];
        arr.push(m.has(t) ? m.get(t)! : null);
        histParTrack.set(t, arr);
      });
    });
    prevPositions = parEdition.get(historiqueEditions[historiqueEditions.length - 1].id) ?? new Map();
  }

  // Mise à jour de chaque entrée.
  let eligibles = 0;
  for (const e of listeEntrees) {
    const fp = posParEntry.get(e.id) ?? null;
    if (fp == null || !e.track_id) {
      await supabase
        .from("chart_entries")
        .update({ filtered_position: null, movement: null, entry_status: "exit" })
        .eq("id", e.id);
      continue;
    }
    eligibles++;
    const hist = histParTrack.get(e.track_id) ?? [];
    const aDejaFigure = hist.some((p) => p != null);
    const prev = prevPositions.get(e.track_id) ?? null;
    const mv = calculerMouvement(fp, { previousFilteredPosition: prev, aDejaFigure });
    const indic = calculerHistorique(fp, hist);
    await supabase
      .from("chart_entries")
      .update({
        filtered_position: fp,
        previous_filtered_position: mv.previousFilteredPosition,
        movement: mv.movement,
        entry_status: mv.entryStatus,
        peak_filtered_position: indic.peakFilteredPosition,
        weeks_on_chart: indic.weeksOnChart,
        consecutive_weeks: indic.consecutiveWeeks,
      })
      .eq("id", e.id);
  }

  await supabase.from("chart_editions").update({ entry_count: eligibles }).eq("id", editionId);
  return { eligibles };
}
