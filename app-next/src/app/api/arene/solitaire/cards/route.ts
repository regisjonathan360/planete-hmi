/**
 * GET /api/arene/solitaire/cards — Configurations des cartes du Solitaire
 *
 * Endpoint public (pas d'auth) retournant les 52 cartes avec :
 * - l'artiste illustrant la carte (id, nom, photo) ;
 * - le masque/cadrage effectif (preset du rang + overrides de la carte).
 * Toutes les valeurs de masque/cadrage sont relatives (0→1).
 *
 * Consommé par SolitaireCardsProvider (jeu) et l'aperçu admin.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildCardFaceConfigs,
  type CardFaceConfig,
  type SolitaireRankPresetRow,
  type SolitaireCardRow,
} from "@/lib/solitaire/cards";
import { artistAvatarSrc } from "@/lib/artists/avatar";

export const dynamic = "force-dynamic";
/** Cache CDN/ISR : les personnalisations se propagent vite, 60 s suffisent. */
export const revalidate = 60;

interface ArtistRow {
  id: string;
  name: string;
  image_url: string | null;
}

export async function GET() {
  const supabase = await createClient();

  const [presetsResult, cardsResult] = await Promise.all([
    supabase.from("solitaire_rank_presets").select("*"),
    supabase
      .from("solitaire_cards")
      .select("card_key, artist_id, mask_type, mask_scale, mask_pos_x, mask_pos_y, image_zoom, image_pos_x, image_pos_y"),
  ]);

  if (presetsResult.error || cardsResult.error) {
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: "Erreur lors de la récupération des configurations.",
        },
      },
      { status: 500 }
    );
  }

  const artistIds = [
    ...new Set(
      (cardsResult.data as SolitaireCardRow[] | null)
        ?.map((row) => row.artist_id)
        .filter((id): id is string => !!id) ?? []
    ),
  ];

  const artistsResult = artistIds.length
    ? await supabase
        .from("artists")
        .select("id, name, image_url")
        .in("id", artistIds)
    : { data: [] as ArtistRow[], error: null };

  if (artistsResult.error) {
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: "Erreur lors de la récupération des configurations.",
        },
      },
      { status: 500 }
    );
  }

  const artists = new Map<string, ArtistRow>(
    (artistsResult.data as ArtistRow[] | null)?.map((artist) => [artist.id, artist]) ?? []
  );

  const cards: CardFaceConfig[] = buildCardFaceConfigs({
    presets: (presetsResult.data as SolitaireRankPresetRow[]) ?? [],
    cards: (cardsResult.data as SolitaireCardRow[]) ?? [],
  }).map((config) => {
    if (!config.artistId) return config;
    const artist = artists.get(config.artistId);
    return {
      ...config,
      artistName: artist?.name ?? null,
      artistImageUrl: artist ? artistAvatarSrc(artist.image_url) : null,
    };
  });

  return NextResponse.json({ cards });
}
