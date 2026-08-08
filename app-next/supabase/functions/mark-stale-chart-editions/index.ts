// Marque périmées les éditions publiées dont la source n'a pas été actualisée
// pour la semaine courante. Conserve la dernière édition valide (ne la supprime pas).
import { json, serviceClient, logSyncRun } from "../_shared/utils.ts";

Deno.serve(async () => {
  const supabase = serviceClient();
  const startedAt = new Date().toISOString();
  try {
    const { data, error } = await supabase.rpc("mark_stale_editions");
    if (error) throw error;
    await logSyncRun(supabase, { run_type: "mark_stale", started_at: startedAt, finished_at: new Date().toISOString(), status: "success", records_received: data ?? 0 });
    return json({ status: "success", marked: data ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSyncRun(supabase, { run_type: "mark_stale", started_at: startedAt, finished_at: new Date().toISOString(), status: "error", error_message: msg });
    return json({ status: "error", message: msg }, 500);
  }
});
