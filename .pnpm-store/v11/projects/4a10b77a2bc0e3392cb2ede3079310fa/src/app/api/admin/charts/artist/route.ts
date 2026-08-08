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

  const { data: currentArtist, error: currentArtistError } = await supabase
    .from("artists")
    .select("is_excluded")
    .eq("id", artistId)
    .maybeSingle();
  if (currentArtistError) return NextResponse.json({ error: currentArtistError.message }, { status: 500 });
  if (!currentArtist) return NextResponse.json({ error: "Artiste introuvable." }, { status: 404 });

  if (status !== "refuse" && currentArtist.is_excluded) {
    return NextResponse.json(
      { error: "Cet artiste est exclu globalement. Réintégrez-le depuis la liste Artistes exclus." },
      { status: 409 },
    );
  }

  if (status === "refuse") {
    const { data: exclusionData, error: exclusionError } = await supabase.rpc("set_artist_exclusion", {
      p_artist_id: artistId,
      p_excluded: true,
      p_reason: "Artiste refusé depuis la validation d’un classement.",
      p_changed_by: auth.user.id,
    });
    const exclusion = Array.isArray(exclusionData) ? exclusionData[0] : exclusionData;
    if (exclusionError || !exclusion?.success) {
      return NextResponse.json({ error: exclusionError?.message ?? "Exclusion globale impossible." }, { status: 500 });
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (mapping.haitianStatus) {
    patch.haitian_status = mapping.haitianStatus;
    patch.verified_at = mapping.haitianStatus.startsWith("verified") ? new Date().toISOString() : null;
    patch.verified_by = auth.user.id;
  }
  if (typeof mapping.isActive === "boolean" && status !== "refuse") {
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
          ? "Artiste exclu globalement : il sera ignoré par toutes les prochaines collectes."
          : status === "masque"
            ? "Artiste masqué."
            : "Statut remis à « à vérifier ».",
  });
}
