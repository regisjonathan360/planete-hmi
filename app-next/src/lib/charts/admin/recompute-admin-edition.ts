/**
 * Recalcul des positions d'une édition SOUS CONTRÔLE ADMIN.
 *
 * Différence avec publish/recompute-edition.ts (moteur d'éligibilité) :
 * ici l'administrateur pilote manuellement le classement Audiomack. Les
 * positions filtrées (1..N) sont attribuées aux entrées VISIBLES
 * (ni masquées, ni exclues), triées par ordre manuel puis par position source.
 *
 * Auto-renumérotation : si le n°3 est retiré/masqué, le n°4 devient n°3.
 * Chaque changement de position est journalisé dans chart_entry_history.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

interface AdminEntryRow {
  id: string;
  track_id: string | null;
  source_position: number;
  admin_position: number | null;
  filtered_position: number | null;
  is_hidden: boolean;
  is_excluded: boolean;
}

export interface RecomputeAdminResult {
  visible: number;
  hidden: number;
  excluded: number;
  changed: number;
}

/**
 * Recalcule filtered_position pour une édition et journalise les mouvements.
 * `source` et `action` servent au journal (ex. action="reorder").
 */
export async function recomputeAdminEdition(
  supabase: SupabaseClient,
  editionId: string,
  options: { action?: string; source?: string; changedBy?: string | null } = {}
): Promise<RecomputeAdminResult> {
  const action = options.action ?? "reorder";
  const source = options.source ?? "audiomack";

  const { data, error } = await supabase
    .from("chart_entries")
    .select("id, track_id, source_position, admin_position, filtered_position, is_hidden, is_excluded")
    .eq("chart_edition_id", editionId);

  if (error) throw new Error(`Lecture des entrées échouée: ${error.message}`);
  const entries = (data ?? []) as AdminEntryRow[];

  // Phase 1 : libérer toutes les positions filtrées pour éviter toute
  // collision transitoire avec la contrainte unique (edition, filtered_position)
  // lors d'un simple échange de positions.
  await supabase
    .from("chart_entries")
    .update({ filtered_position: null })
    .eq("chart_edition_id", editionId);

  const visibles = entries
    .filter((e) => !e.is_hidden && !e.is_excluded)
    .sort((a, b) => {
      const pa = a.admin_position ?? a.source_position;
      const pb = b.admin_position ?? b.source_position;
      if (pa !== pb) return pa - pb;
      return a.source_position - b.source_position;
    });

  let changed = 0;
  const historyRows: Record<string, unknown>[] = [];

  // Entrées visibles : positions 1..N
  for (let i = 0; i < visibles.length; i++) {
    const entry = visibles[i];
    const newPosition = i + 1;
    if (entry.filtered_position !== newPosition) {
      await supabase
        .from("chart_entries")
        .update({ filtered_position: newPosition })
        .eq("id", entry.id);

      historyRows.push({
        chart_edition_id: editionId,
        chart_entry_id: entry.id,
        track_id: entry.track_id,
        old_position: entry.filtered_position,
        new_position: newPosition,
        action,
        source,
        is_manual: true,
        changed_by: options.changedBy ?? null,
      });
      changed++;
    }
  }

  // Entrées masquées/exclues : plus de position filtrée
  const caches = entries.filter((e) => e.is_hidden || e.is_excluded);
  for (const entry of caches) {
    if (entry.filtered_position !== null) {
      await supabase
        .from("chart_entries")
        .update({ filtered_position: null })
        .eq("id", entry.id);

      historyRows.push({
        chart_edition_id: editionId,
        chart_entry_id: entry.id,
        track_id: entry.track_id,
        old_position: entry.filtered_position,
        new_position: null,
        action: entry.is_excluded ? "exclude" : "hide",
        source,
        is_manual: true,
        changed_by: options.changedBy ?? null,
      });
      changed++;
    }
  }

  if (historyRows.length) {
    await supabase.from("chart_entry_history").insert(historyRows);
  }

  // Normaliser admin_position sur la séquence finale pour stabiliser les tris ultérieurs.
  for (let i = 0; i < visibles.length; i++) {
    await supabase
      .from("chart_entries")
      .update({ admin_position: i + 1 })
      .eq("id", visibles[i].id);
  }

  await supabase
    .from("chart_editions")
    .update({ entry_count: visibles.length })
    .eq("id", editionId);

  return {
    visible: visibles.length,
    hidden: entries.filter((e) => e.is_hidden).length,
    excluded: entries.filter((e) => e.is_excluded).length,
    changed,
  };
}
