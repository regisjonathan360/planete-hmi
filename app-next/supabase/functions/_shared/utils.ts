// Utilitaires partagés des Edge Functions (Deno).
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Réponse honnête d'une collecte en mode manuel (aucun faux succès). */
export function manualImportRequired(platform: string): Response {
  return json({
    status: "manual_import_required",
    platform,
    message: "No approved automatic source is currently configured.",
  });
}

/** Enregistre une exécution de synchronisation. */
export async function logSyncRun(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
  await supabase.from("sync_runs").insert(row);
}
