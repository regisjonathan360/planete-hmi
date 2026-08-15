/**
 * GET/POST /api/admin/radio/playlists
 * 
 * Récupère ou crée des playlists radio
 * Requires: admin role
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RadioPlaylist } from "@/lib/radio/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("radio_playlists")
      .select(
        `
        *,
        radio_playlist_tracks(count)
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching playlists:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des playlists" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body: Partial<RadioPlaylist> = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Le nom de la playlist est requis" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("radio_playlists")
      .insert([
        {
          name: body.name,
          description: body.description || null,
          is_default: body.is_default ?? false,
          is_active: body.is_active ?? true,
          shuffle_enabled: body.shuffle_enabled ?? false,
          repeat_enabled: body.repeat_enabled ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating playlist:", error);
      return NextResponse.json(
        { error: "Erreur lors de la création de la playlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
