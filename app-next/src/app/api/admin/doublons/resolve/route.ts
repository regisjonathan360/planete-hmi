/**
 * POST /api/admin/doublons/resolve
 * Résout un candidat à la fusion : merge ou dismiss.
 *
 * Body: { candidateId, action: "merge" | "dismiss", keepId? }
 *
 * Lors d'une fusion :
 * - Transfert des track_artists, platform_identities, user_favorites
 * - Archive l'artiste fusionné (is_active: false)
 * - Sauvegarde l'historique dans artist_merges
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { candidateId, action, keepId } = await request.json();
  if (!candidateId || !action) return NextResponse.json({ error: "Params manquants." }, { status: 400 });

  const supabase = createAdminClient();

  if (action === "dismiss") {
    await supabase.from("artist_merge_candidates").update({ status: "dismissed", resolved_by: auth.user.id, resolved_at: new Date().toISOString() }).eq("id", candidateId);
    return NextResponse.json({ status: "ok", message: "Gardés séparés." });
  }

  if (action === "merge") {
    if (!keepId) return NextResponse.json({ error: "keepId requis pour merge." }, { status: 400 });

    // Charger le candidat
    const { data: candidate } = await supabase
      .from("artist_merge_candidates")
      .select("artist_a_id, artist_b_id")
      .eq("id", candidateId)
      .single();
    if (!candidate) return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });

    const mergedId = keepId === candidate.artist_a_id ? candidate.artist_b_id : candidate.artist_a_id;

    // Sauvegarder l'artiste fusionné dans l'historique
    const { data: mergedArtist } = await supabase.from("artists").select("*").eq("id", mergedId).single();
    if (mergedArtist) {
      await supabase.from("artist_merges").insert({
        kept_artist_id: keepId,
        merged_artist_id: mergedId,
        merged_data: mergedArtist,
        merged_by: auth.user.id,
      });
    }

    // Transférer les track_artists
    await supabase.from("track_artists").update({ artist_id: keepId }).eq("artist_id", mergedId);

    // Transférer les platform_identities
    await supabase.from("artist_platform_identities").update({ artist_id: keepId }).eq("artist_id", mergedId);

    // Transférer les favoris (ignorer les doublons)
    const { data: favs } = await supabase.from("user_favorites").select("user_id").eq("artist_id", mergedId);
    for (const fav of favs ?? []) {
      await supabase.from("user_favorites").upsert(
        { user_id: fav.user_id, artist_id: keepId },
        { onConflict: "user_id,artist_id" }
      );
    }
    await supabase.from("user_favorites").delete().eq("artist_id", mergedId);

    // Désactiver l'artiste fusionné
    await supabase.from("artists").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", mergedId);

    // Marquer le candidat comme résolu
    await supabase.from("artist_merge_candidates").update({
      status: "merged",
      resolved_by: auth.user.id,
      resolved_at: new Date().toISOString(),
    }).eq("id", candidateId);

    return NextResponse.json({ status: "ok", message: `Fusion effectuée. ${mergedArtist?.name ?? "Artiste"} fusionné vers le profil conservé.` });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
