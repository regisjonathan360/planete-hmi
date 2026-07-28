/**
 * POST /api/admin/artistes/[id]/enrich
 * Collecte les données d'UNE plateforme spécifique depuis l'URL renseignée
 * dans la fiche de l'artiste.
 *
 * Corps : { field: "url_spotify" | "url_deezer" | ... }
 *
 * PATCH /api/admin/artistes/[id]/enrich
 * Applique une image collectée comme photo de profil ou bannière.
 *
 * Corps : { imageUrl: string, target: "image_url" | "banner_url" }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichArtistFromField, applyCollectedImage, ENRICHABLE_FIELDS } from "@/lib/artists/enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const field = String((body as Record<string, unknown>)?.field ?? "");

  if (!ENRICHABLE_FIELDS.includes(field)) {
    return NextResponse.json(
      { error: `Champ invalide. Acceptés : ${ENRICHABLE_FIELDS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  try {
    const result = await enrichArtistFromField(supabase, id, field);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichissement impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const imageUrl = String((body as Record<string, unknown>)?.imageUrl ?? "").trim();
  const target = String((body as Record<string, unknown>)?.target ?? "");

  if (!imageUrl.startsWith("http")) {
    return NextResponse.json({ error: "URL d'image invalide." }, { status: 400 });
  }
  if (target !== "image_url" && target !== "banner_url") {
    return NextResponse.json({ error: "target doit être 'image_url' ou 'banner_url'." }, { status: 400 });
  }

  const supabase = createAdminClient();
  try {
    await applyCollectedImage(supabase, id, imageUrl, target);
    return NextResponse.json({
      ok: true,
      message: target === "image_url" ? "Photo de profil mise à jour." : "Bannière mise à jour.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur." },
      { status: 500 },
    );
  }
}
