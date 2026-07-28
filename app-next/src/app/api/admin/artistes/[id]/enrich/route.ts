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
import {
  enrichArtistFromField,
  enrichArtistFromAllFields,
  applyCollectedImage,
  getStoredEnrichment,
  ENRICHABLE_FIELDS,
  type EnrichableField,
} from "@/lib/artists/enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, ...await getStoredEnrichment(createAdminClient(), id) });
  } catch (error) {
    console.warn("[artist-enrich] history_failed", {
      artistId: id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Historique indisponible." },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bodyRecord = body as Record<string, unknown>;
  const field = String(bodyRecord.field ?? "");

  if (field !== "all" && !ENRICHABLE_FIELDS.includes(field as EnrichableField)) {
    return NextResponse.json(
      { error: `Champ invalide. Acceptés : ${ENRICHABLE_FIELDS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  try {
    if (field === "all") {
      const rawUrls = bodyRecord.urls && typeof bodyRecord.urls === "object"
        ? bodyRecord.urls as Record<string, unknown>
        : {};
      const urls = Object.fromEntries(
        ENRICHABLE_FIELDS
          .filter((candidate) => typeof rawUrls[candidate] === "string")
          .map((candidate) => [candidate, String(rawUrls[candidate])]),
      ) as Partial<Record<EnrichableField, string>>;
      const results = await enrichArtistFromAllFields(supabase, id, urls);
      const failures = Object.values(results).filter((result) => result.error).length;
      console.info("[artist-enrich] collection_all_completed", {
        artistId: id,
        platforms: Object.keys(results).length,
        failures,
      });
      return NextResponse.json({ ok: true, results, failures });
    }
    const urlOverride = typeof bodyRecord.url === "string" ? bodyRecord.url : undefined;
    const result = await enrichArtistFromField(supabase, id, field as EnrichableField, urlOverride);
    console.info("[artist-enrich] collection_completed", {
      artistId: id,
      field,
      images: result.images.length,
      hasError: Boolean(result.error),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.warn("[artist-enrich] collection_failed", {
      artistId: id,
      field,
      message: err instanceof Error ? err.message : "unknown",
    });
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
    const applied = await applyCollectedImage(supabase, id, imageUrl, target);
    console.info("[artist-enrich] image_applied", {
      artistId: id,
      target,
      archived: applied.archived,
    });
    return NextResponse.json({
      ok: true,
      url: applied.url,
      archived: applied.archived,
      message: target === "image_url" ? "Photo de profil mise à jour." : "Bannière mise à jour.",
    });
  } catch (err) {
    console.warn("[artist-enrich] image_apply_failed", {
      artistId: id,
      target,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur." },
      { status: 500 },
    );
  }
}
