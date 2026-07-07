"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAudit } from "@/lib/charts/audit";

export async function toggleSourceEnabled(sourceKey: string, enabled: boolean) {
  const { user, supabase } = await requireAdmin();
  const { error } = await supabase
    .from("chart_sources")
    .update({ is_enabled: enabled })
    .eq("source_key", sourceKey);
  if (error) return { ok: false, message: error.message };
  await logAudit(supabase, {
    userId: user.id,
    action: enabled ? "source_enable" : "source_disable",
    entityType: "chart_source",
    entityId: null,
    newValue: { sourceKey, enabled },
  });
  revalidatePath("/admin/charts/sources");
  revalidatePath("/charts");
  return { ok: true, message: enabled ? "Source activée." : "Source désactivée." };
}
