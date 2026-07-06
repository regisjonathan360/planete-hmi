// Traite un import brut (JSON) : validation, normalisation, création des entrées.
// Appelé par l'admin après avoir téléversé un fichier.
import { json, serviceClient, logSyncRun } from "../_shared/utils.ts";

function normalizeTitle(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\(official (music )?video\)/gi, "").replace(/\(audio\)/gi, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  const supabase = serviceClient();
  const startedAt = new Date().toISOString();
  let body: { importId: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return json({ status: "error", message: "JSON invalide." }, 400);
  }
  if (!body?.importId) return json({ status: "error", message: "importId requis." }, 400);

  const { data: imp } = await supabase.from("chart_imports").select("*").eq("id", body.importId).single();
  if (!imp) return json({ status: "error", message: "Import introuvable." }, 404);

  const rows = (imp.raw_payload as unknown[]) ?? [];
  let processed = 0;
  for (const r of rows) {
    const row = r as { source_position?: number; track_title?: string; artist_names?: string };
    if (!row.source_position || !row.track_title || !row.artist_names) continue;
    const nt = normalizeTitle(row.track_title);
    const { data: existing } = await supabase.from("tracks").select("id").eq("normalized_title", nt).limit(1);
    if (!existing?.length) {
      await supabase.from("tracks").insert({ title: row.track_title, normalized_title: nt });
    }
    processed++;
  }

  await supabase.from("chart_imports").update({ status: "processed", valid_row_count: processed }).eq("id", body.importId);
  await logSyncRun(supabase, { run_type: "process_import", started_at: startedAt, finished_at: new Date().toISOString(), status: "success", records_received: rows.length, records_normalized: processed, chart_source_id: imp.chart_source_id });
  return json({ status: "success", processed });
});
