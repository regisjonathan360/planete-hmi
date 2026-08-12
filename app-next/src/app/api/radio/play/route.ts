/**
 * API route pour enregistrer l'écoute d'une piste
 * POST /api/radio/play
 */
import { NextResponse } from "next/server";
import { recordPlayHistory, incrementPlayCount } from "@/lib/radio/queries";
import { z } from "zod";

export const dynamic = "force-dynamic";

const playSchema = z.object({
  trackId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trackId } = playSchema.parse(body);

    // Enregistrer dans l'historique
    await recordPlayHistory(trackId);

    // Incrémenter le compteur de lecture
    await incrementPlayCount(trackId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording play:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'écoute" },
      { status: 500 }
    );
  }
}
