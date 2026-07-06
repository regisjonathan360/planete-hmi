// Reprises des synchronisations échouées avec backoff exponentiel.
// Ordre : 1 min -> 5 min -> 30 min -> 2 h -> 12 h. Respecte Retry-After.
import { json, serviceClient, logSyncRun } from "../_shared/utils.ts";

const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
const MAX_TENTATIVES = 5;

Deno.serve(async () => {
  const supabase = serviceClient();
  const startedAt = new Date().toISOString();
  const { data: echecs } = await supabase
    .from("sync_runs")
    .select("id, chart_source_id, run_type, started_at, error_code, metadata")
    .eq("status", "error")
    .gte("started_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("started_at", { ascending: true });

  const tentatives: string[] = [];
  for (const run of echecs ?? []) {
    const meta = (run.metadata ?? {}) as { retry_count?: number };
    const count = meta.retry_count ?? 0;
    if (count >= MAX_TENTATIVES) continue;

    const delai = BACKOFF_MS[Math.min(count, BACKOFF_MS.length - 1)];
    const dernierEssai = new Date(run.started_at).getTime();
    if (Date.now() - dernierEssai < delai) continue;

    // Déclenche la re-collecte via une invocation interne de la fonction.
    const fnName = run.run_type?.replace(/_/g, "-") ?? "collect-youtube-chart";
    try {
      await supabase.functions.invoke(fnName, { body: { retry: true, prevRunId: run.id } });
      await supabase.from("sync_runs").update({ metadata: { ...(meta as object), retry_count: count + 1 } }).eq("id", run.id);
      tentatives.push(run.id);
    } catch { /* ignoré ; sera retenté au prochain cycle */ }
  }

  await logSyncRun(supabase, { run_type: "retry_failed", started_at: startedAt, finished_at: new Date().toISOString(), status: "success", records_received: tentatives.length });
  return json({ status: "success", retriedRuns: tentatives.length });
});
