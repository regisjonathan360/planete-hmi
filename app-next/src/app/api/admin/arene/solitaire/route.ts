/**
 * GET /api/admin/arene/solitaire — Données brutes pour l'administration
 *
 * Retourne les personnalisations par carte (avec nom d'artiste) et les
 * presets par rang, tels que stockés en base. La fusion (preset + override)
 * est servie par l'endpoint public GET /api/arene/solitaire/cards.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const supabase = createAdminClient();

    const [cardsResult, presetsResult] = await Promise.all([
      supabase
        .from("solitaire_cards")
        .select("card_key, artist_id, mask_type, mask_scale, mask_pos_x, mask_pos_y, image_zoom, image_pos_x, image_pos_y, artists(name, image_url)"),
      supabase
        .from("solitaire_rank_presets")
        .select("rank, mask_type, mask_scale, mask_pos_x, mask_pos_y, image_zoom, image_pos_x, image_pos_y")
        .order("rank"),
    ]);

    if (cardsResult.error || presetsResult.error) {
      return NextResponse.json(
        { error: { code: "database_error", message: "Erreur lors de la lecture des cartes." } },
        { status: 500 }
      );
    }

    const cards = (cardsResult.data ?? []).map((card) => ({
      ...card,
      artistName: (card.artists as unknown as { name: string } | null)?.name ?? null,
      artistImageUrl: (card.artists as unknown as { image_url: string } | null)?.image_url ?? null,
      artists: undefined,
    }));

    return NextResponse.json({ cards, presets: presetsResult.data ?? [] });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}
