"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAudit } from "@/lib/charts/audit";

/** Résout une correspondance de la file : associe une chanson ou rejette. */
export async function resolveMatchAction(
  queueId: string,
  decision: "resolved" | "rejected",
  resolvedTrackId?: string
): Promise<{ ok: boolean; message: string }> {
  const { user, supabase } = await requireAdmin();
  const { error } = await supabase
    .from("chart_match_queue")
    .update({
      resolution_status: decision,
      resolved_track_id: resolvedTrackId ?? null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", queueId);
  if (error) return { ok: false, message: error.message };
  await logAudit(supabase, {
    userId: user.id,
    action: "match_resolve",
    entityType: "chart_match_queue",
    entityId: queueId,
    newValue: { decision, resolvedTrackId },
  });
  revalidatePath("/admin/charts/review");
  return { ok: true, message: decision === "resolved" ? "Correspondance résolue." : "Entrée rejetée." };
}
