import type { SupabaseClient } from "@supabase/supabase-js";

/** Journalise une action administrative dans chart_audit_logs. */
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  }
): Promise<void> {
  await supabase.from("chart_audit_logs").insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    reason: params.reason ?? null,
  });
}
