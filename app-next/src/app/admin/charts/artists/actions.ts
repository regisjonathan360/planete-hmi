"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logAudit } from "@/lib/charts/audit";
import { recomputeEdition } from "@/lib/charts/publish/recompute-edition";
import type { HaitianStatus } from "@/lib/charts/types";

const STATUTS_AUTORISES: HaitianStatus[] = [
  "verified_haitian",
  "verified_haitian_diaspora",
  "verified_haitian_group",
  "pending_review",
  "insufficient_evidence",
  "rejected",
];

export async function updateArtistStatusAction(
  artistId: string,
  status: HaitianStatus
): Promise<{ ok: boolean; message: string }> {
  if (!STATUTS_AUTORISES.includes(status)) {
    return { ok: false, message: "Statut invalide." };
  }

  const { user, supabase } = await requireAdmin();
  const verified = status.startsWith("verified_");

  const { data: before } = await supabase
    .from("artists")
    .select("id, name, haitian_status")
    .eq("id", artistId)
    .single();

  const { error } = await supabase
    .from("artists")
    .update({
      haitian_status: status,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? user.id : null,
    })
    .eq("id", artistId);

  if (error) return { ok: false, message: error.message };

  const { data: trackLinks } = await supabase
    .from("track_artists")
    .select("track_id")
    .eq("artist_id", artistId);

  const trackIds = [...new Set((trackLinks ?? []).map((row) => row.track_id).filter(Boolean))];
  let recalculated = 0;

  if (trackIds.length > 0) {
    const { data: entries } = await supabase
      .from("chart_entries")
      .select("chart_edition_id")
      .in("track_id", trackIds);

    const editionIds = [...new Set((entries ?? []).map((row) => row.chart_edition_id).filter(Boolean))];
    for (const editionId of editionIds) {
      await recomputeEdition(supabase, editionId);
      recalculated++;
    }
  }

  await logAudit(supabase, {
    userId: user.id,
    action: "artist_haitian_status_update",
    entityType: "artists",
    entityId: artistId,
    oldValue: before ?? null,
    newValue: { haitian_status: status },
  });

  revalidatePath("/admin/charts/artists");
  revalidatePath("/admin/charts/history");
  revalidatePath("/charts");
  revalidatePath("/charts/[platform]", "page");

  return {
    ok: true,
    message: recalculated > 0
      ? `Statut mis a jour. ${recalculated} edition(s) recalculee(s).`
      : "Statut mis a jour.",
  };
}
