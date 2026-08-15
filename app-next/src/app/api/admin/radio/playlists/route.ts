/**
 * API route pour la gestion des playlists radio
 * POST /api/admin/radio/playlists - Créer une playlist
 * GET /api/admin/radio/playlists - Lister les playlists
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getAllPlaylists } from "@/lib/radio/queries";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  shuffle_enabled: z.boolean().default(true),
  repeat_enabled: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = await createClient();

  try {
    const body = await request.json();
    const data = createPlaylistSchema.parse(body);

    const { data: playlist, error } = await supabase
      .from("radio_playlists")
      .insert({
        ...data,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(playlist);
  } catch (error: any) {
    console.error("Error creating playlist:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la création" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const playlists = await getAllPlaylists();
  return NextResponse.json(playlists);
}
