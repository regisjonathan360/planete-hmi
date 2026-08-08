/**
 * POST /api/admin/charts/artist-tags
 * Attribuer des étiquettes de rôle à un artiste.
 *
 * Body: { artistId: string, tags: string[] }
 * tags ex: ["chanteur", "rappeur"]
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARTIST_TAGS } from "@/lib/artists/tags";

export const dynamic = "force-dynamic";

const validTagIds = new Set(ARTIST_TAGS.map((t) => t.id));

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { artistId?: string; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { artistId, tags } = body;
  if (!artistId || !Array.isArray(tags)) {
    return NextResponse.json({ error: "artistId et tags (tableau) requis." }, { status: 400 });
  }

  // Valider les tags.
  const validTags = tags.filter((t) => validTagIds.has(t as never));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artists")
    .update({ tags: validTags })
    .eq("id", artistId);

  if (error) {
    return NextResponse.json({ error: `Mise à jour échouée: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    tags: validTags,
    message: validTags.length > 0
      ? `Étiquettes mises à jour : ${validTags.join(", ")}`
      : "Étiquettes retirées.",
  });
}
