/**
 * POST /api/admin/charts/artist
 * Validation manuelle du statut haïtien d'un artiste.
 *
 * Body: { artistId: string, status: "a_verifier" | "valide" | "refuse" | "masque", editionId?: string }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUT_UI_VERS_DB, type AdminValidationStatus } from "@/lib/charts/admin/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { artistId?: string; status?: AdminValidationStatus; editionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { artistId, status } = body;
  if (!artistId || !status || !(status in STATUT_UI_VERS_DB)) {
    return NextResponse.json({ error: "artistId et status valide requis." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const mapping = STATUT_UI_VERS_DB[status];

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (mapping.haitianStatus) {
    patch.haitian_status = mapping.haitianStatus;
    patch.verified_at = mapping.haitianStatus.startsWith("verified") ? new Date().toISOString() : null;
    patch.verified_by = auth.user.id;
  }
  if (typeof mapping.isActive === "boolean") {
    patch.is_active = mapping.isActive;
  }

  const { error } = await supabase.from("artists").update(patch).eq("id", artistId);
  if (error) {
    return NextResponse.json({ error: `Mise à jour échouée: ${error.message}` }, { status: 500 });
  }

  await supabase.from("chart_audit_logs").insert({
    user_id: auth.user.id,
    action: "validate_artist",
    entity_type: "artist",
    entity_id: artistId,
    new_value: { status },
    reason: `Validation admin: ${status}`,
  });

  return NextResponse.json({
    status: "ok",
    message:
      status === "valide"
        ? "Artiste validé comme haïtien. Il apparaîtra sur le site après publication."
        : status === "refuse"
          ? "Artiste refusé : ses titres ne seront pas publiés."
          : status === "masque"
            ? "Artiste masqué."
            : "Statut remis à « à vérifier ».",
  });
}
