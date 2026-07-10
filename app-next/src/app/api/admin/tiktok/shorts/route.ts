import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShortsSelectionSchema } from "@/lib/tiktok/schemas";
import { MAX_FEATURED_SHORTS } from "@/lib/tiktok/constants";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET : Liste des vidéos featured actuelles + recherche de vidéos
// Si ?search=xxx est présent, recherche dans tiktok_videos (sons validés)
// Sinon retourne les shorts featured
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  // --- Mode recherche ---
  if (search) {
    const query = `%${search}%`;
    const { data, error } = await supabase
      .from("tiktok_videos")
      .select(
        "video_id, username, music_id, view_count, " +
        "tiktok_sounds(sound_title, sound_author, validation_status)"
      )
      .or(`username.ilike.${query},video_id.ilike.${query}`)
      .eq("tiktok_sounds.validation_status", "valide")
      .not("tiktok_sounds", "is", null)
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filtrer côté serveur les résultats dont le son n'est pas valide
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = (data ?? []).filter(
      (v: any) => v.tiktok_sounds != null
    );

    return NextResponse.json({ results: filtered });
  }

  // --- Mode listing featured ---
  const { data, error } = await supabase
    .from("tiktok_featured_shorts")
    .select(
      "id, video_id, music_id, display_order, selected_at, selected_by, " +
      "tiktok_videos(video_id, username, music_id), " +
      "tiktok_sounds(sound_title, sound_author, validation_status)"
    )
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shorts: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST : Sélection / désélection de vidéos pour HMI Shorts
// Actions supportées : "add" | "remove"
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { action, ...rest } = body as Record<string, unknown>;
  const supabase = createAdminClient();

  // --- Action : Ajouter une vidéo featured ---
  if (action === "add") {
    const parsed = ShortsSelectionSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides." },
        { status: 400 }
      );
    }

    // Vérifier la contrainte max 10
    const { count, error: countError } = await supabase
      .from("tiktok_featured_shorts")
      .select("*", { count: "exact", head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= MAX_FEATURED_SHORTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FEATURED_SHORTS} vidéos featured atteint.` },
        { status: 400 }
      );
    }

    // Vérifier que le son associé a le statut "valide"
    const { data: sound, error: soundError } = await supabase
      .from("tiktok_sounds")
      .select("validation_status")
      .eq("music_id", parsed.data.music_id)
      .maybeSingle();

    if (soundError) {
      return NextResponse.json({ error: soundError.message }, { status: 500 });
    }

    if (!sound || sound.validation_status !== "valide") {
      return NextResponse.json(
        { error: "Le son associé doit avoir le statut 'valide'." },
        { status: 400 }
      );
    }

    // Upsert la vidéo featured (on conflict video_id → mise à jour)
    const { error: insertError } = await supabase
      .from("tiktok_featured_shorts")
      .upsert(
        {
          video_id: parsed.data.video_id,
          music_id: parsed.data.music_id,
          display_order: parsed.data.display_order,
          selected_at: new Date().toISOString(),
          selected_by: auth.user.id,
        },
        { onConflict: "video_id" }
      );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "added" });
  }

  // --- Action : Retirer une vidéo featured ---
  if (action === "remove") {
    const videoId = rest.video_id;
    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json({ error: "video_id requis." }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("tiktok_featured_shorts")
      .delete()
      .eq("video_id", videoId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "removed" });
  }

  // --- Action inconnue ---
  return NextResponse.json(
    { error: "Action inconnue. Actions valides : add, remove." },
    { status: 400 }
  );
}
