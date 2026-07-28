/**
 * POST /api/admin/artistes/[id]/enrich
 * Récupère toutes les données disponibles depuis les plateformes rattachées
 * à l'artiste et met à jour sa fiche.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichArtist } from "@/lib/artists/enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const report = await enrichArtist(supabase, id);
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichissement impossible." },
      { status: 500 },
    );
  }
}
