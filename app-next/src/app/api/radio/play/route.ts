/**
 * POST /api/radio/play
 * 
 * Enregistre qu'une piste a été écoutée
 * Public endpoint (pas d'authentification requise)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: { trackId: string } = await request.json();

    if (!body.trackId) {
      return NextResponse.json(
        { error: "trackId est requis" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Enregistrer dans l'historique de lecture
    const { error: historyError } = await supabase
      .from("radio_play_history")
      .insert([
        {
          track_id: body.trackId,
          played_at: new Date().toISOString(),
          listener_count: 1,
          completed: false,
        },
      ]);

    if (historyError) {
      console.error("Error recording play history:", historyError);
      // Ne pas retourner d'erreur au client, juste log
    }

    // Incrémenter le play_count du track
    const { error: rpcError } = await supabase.rpc("increment_track_play_count", {
      track_id: body.trackId,
    });

    if (rpcError) {
      console.error("Error incrementing play count:", rpcError);
      // Ne pas retourner d'erreur au client, juste log
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { success: false },
      { status: 200 } // On retourne 200 même en cas d'erreur pour ne pas bloquer la lecture
    );
  }
}
