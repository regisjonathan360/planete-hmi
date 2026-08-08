/**
 * POST /api/admin/artistes/backfill-images
 * Complète les photos de profil vides en reprenant celle d'une plateforme
 * déjà rattachée à la fiche de l'artiste (Spotify, Deezer, Audiomack, YouTube…).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const rawLimit = Number((body as Record<string, unknown>)?.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 5000) : 1000;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("backfill_artist_images", { p_limit: limit });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Array.isArray(data) ? data[0] : data;
  const updated = Number(result?.updated_count ?? 0);
  const remaining = Number(result?.remaining_count ?? 0);

  return NextResponse.json({
    ok: true,
    updated,
    remaining,
    message:
      updated === 0
        ? "Aucune photo à compléter : les fiches vides n'ont aucune plateforme rattachée."
        : `${updated} photo(s) complétée(s) depuis les plateformes rattachées.${
            remaining > 0 ? ` ${remaining} fiche(s) restante(s), relancez pour continuer.` : ""
          }`,
  });
}
