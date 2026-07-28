/**
 * Réglages d'une source de classement alimentée par une playlist.
 *
 * GET   ?sourceKey=… — état de la source (playlist, dernière collecte, erreur).
 * PATCH — change la playlist, le libellé ou l'activation.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPlaylistChartSource } from "@/lib/charts/playlist-sources";
import { parseSpotifyPlaylistId } from "@/lib/spotify/playlist";

export const dynamic = "force-dynamic";

const SELECT =
  "source_key, platform, display_name, chart_context, source_url, is_enabled, " +
  "ingestion_mode, last_success_at, last_failure_at, last_error";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sourceKey = new URL(request.url).searchParams.get("sourceKey") ?? "";
  if (!findPlaylistChartSource(sourceKey)) {
    return NextResponse.json({ error: "Classement inconnu." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chart_sources")
    .select(SELECT)
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, source: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const sourceKey = String(input.sourceKey ?? "");
  const source = findPlaylistChartSource(sourceKey);
  if (!source) return NextResponse.json({ error: "Classement inconnu." }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ("playlistUrl" in input) {
    const raw = String(input.playlistUrl ?? "").trim();
    if (!raw) {
      // Vide = revenir à la playlist livrée par défaut.
      patch.source_url = source.defaultPlaylistUrl;
    } else {
      const playlistId = parseSpotifyPlaylistId(raw);
      if (!playlistId) {
        return NextResponse.json(
          {
            error:
              "Lien de playlist Spotify invalide. Attendu : https://open.spotify.com/playlist/<identifiant>",
          },
          { status: 400 },
        );
      }
      patch.source_url = `https://open.spotify.com/playlist/${playlistId}`;
    }
  }

  if ("displayName" in input) {
    const name = String(input.displayName ?? "").trim();
    if (name.length < 3) {
      return NextResponse.json({ error: "Le libellé doit faire au moins 3 caractères." }, { status: 400 });
    }
    patch.display_name = name;
  }

  if ("isEnabled" in input) {
    if (typeof input.isEnabled !== "boolean") {
      return NextResponse.json({ error: "isEnabled doit être un booléen." }, { status: 400 });
    }
    patch.is_enabled = input.isEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucun réglage à modifier." }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("chart_sources")
    .update(patch)
    .eq("source_key", sourceKey)
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "Source absente en base. Lancez une première collecte pour la créer." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, source: data, message: "Réglages enregistrés." });
}
