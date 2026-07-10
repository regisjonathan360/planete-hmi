import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/shorts
 * Endpoint public (pas d'auth requise) — retourne les vidéos featured
 * pour la section HMI Shorts de la homepage.
 * Seules les vidéos associées à un son validé sont retournées.
 * Maximum 10 résultats, triés par display_order.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("tiktok_featured_shorts")
      .select(
        "id, video_id, music_id, display_order, " +
        "tiktok_videos(video_id, username), " +
        "tiktok_sounds(sound_title, sound_author, validation_status)"
      )
      .order("display_order", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[api/shorts] Erreur Supabase:", error.message);
      return NextResponse.json({ shorts: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];

    // Filtrer côté serveur : uniquement les sons avec validation_status = "valide"
    const validated = rows.filter((entry) => {
      return entry.tiktok_sounds?.validation_status === "valide";
    });

    // Mapper vers un format public simplifié
    const shorts = validated.map((entry) => {
      return {
        video_id: entry.video_id,
        username: entry.tiktok_videos?.username ?? "inconnu",
        sound_title: entry.tiktok_sounds?.sound_title ?? "Son inconnu",
        sound_author: entry.tiktok_sounds?.sound_author ?? null,
        display_order: entry.display_order,
      };
    });

    return NextResponse.json({ shorts });
  } catch (err) {
    console.error("[api/shorts] Erreur inattendue:", err);
    return NextResponse.json({ shorts: [] });
  }
}
