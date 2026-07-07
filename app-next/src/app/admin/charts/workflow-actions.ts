"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validerLignesImport } from "@/lib/charts/validation/schemas";
import { normalizeTitle } from "@/lib/charts/normalization/normalize-title";
import { normalizeArtists } from "@/lib/charts/normalization/normalize-artists";
import { validerEdition, EntreeAValider } from "@/lib/charts/validation/validate-edition";
import { recomputeEdition } from "@/lib/charts/publish/recompute-edition";
import { logAudit } from "@/lib/charts/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

function isoPeriode(d: string, finDeJournee = false): string {
  if (d.includes("T")) return d;
  return `${d}T${finDeJournee ? "23:59:59" : "00:00:00"}Z`;
}

function slugifie(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Résout une chanson existante (titre normalisé/ISRC) ou la crée (artistes en pending). */
async function resoudreOuCreerTrack(
  supabase: SupabaseClient,
  titre: string,
  artistesTexte: string,
  isrc?: string
): Promise<string> {
  const nt = normalizeTitle(titre);
  const { data: existants } = await supabase
    .from("tracks")
    .select("id, normalized_title, isrc")
    .or(`normalized_title.eq.${nt}${isrc ? `,isrc.eq.${isrc}` : ""}`)
    .limit(1);
  if (existants && existants.length) return existants[0].id;

  const { data: nouveau, error } = await supabase
    .from("tracks")
    .insert({ title: titre, normalized_title: nt, isrc: isrc ?? null })
    .select("id")
    .single();
  if (error || !nouveau) throw new Error(`Création chanson échouée : ${error?.message}`);

  const artistes = normalizeArtists(artistesTexte);
  for (const a of artistes) {
    const slug = slugifie(a.nom) || `artiste-${Date.now()}`;
    let artistId: string | null = null;
    const { data: aExist } = await supabase.from("artists").select("id").eq("slug", slug).limit(1);
    if (aExist && aExist.length) artistId = aExist[0].id;
    else {
      const { data: aNew } = await supabase
        .from("artists")
        .insert({ name: a.nom, slug, haitian_status: "pending_review" })
        .select("id")
        .single();
      artistId = aNew?.id ?? null;
    }
    if (artistId) {
      await supabase
        .from("track_artists")
        .insert({ track_id: nouveau.id, artist_id: artistId, role: a.role, billing_order: a.billingOrder });
    }
  }
  return nouveau.id;
}

async function enregistrerPlatformTrack(
  supabase: SupabaseClient,
  params: {
    platform: string;
    trackId: string;
    externalId: string;
    title: string;
    artistText: string;
    externalUrl?: string | null;
    artworkUrl?: string | null;
    isrc?: string | null;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("platform_tracks")
    .upsert({
      track_id: params.trackId,
      platform: params.platform,
      external_id: params.externalId,
      external_url: params.externalUrl ?? null,
      platform_title: params.title,
      platform_artist_text: params.artistText,
      isrc: params.isrc ?? null,
      artwork_url: params.artworkUrl ?? null,
      match_status: "admin_import",
      match_confidence: 1,
      verified_at: new Date().toISOString(),
    }, { onConflict: "platform,external_id" })
    .select("id")
    .single();

  if (error) throw new Error(`Correspondance plateforme echouee : ${error.message}`);
  return data?.id ?? null;
}

export interface ResultatCommit {
  ok: boolean;
  editionId?: string;
  message: string;
  eligibles?: number;
}

/** Crée une édition brouillon à partir d'un import vérifié, puis recalcule. */
export async function commitImport(sourceKey: string, rowsBrutes: unknown[]): Promise<ResultatCommit> {
  const { user, supabase } = await requireAdmin();
  const { valides, invalides } = validerLignesImport(rowsBrutes);
  if (!valides.length) return { ok: false, message: `Aucune ligne valide (${invalides.length} invalides).` };

  const { data: source } = await supabase
    .from("chart_sources")
    .select("id, platform")
    .eq("source_key", sourceKey)
    .single();
  if (!source) return { ok: false, message: "Source inconnue." };

  const periodStart = isoPeriode(valides[0].source_period_start);
  const periodEnd = isoPeriode(valides[0].source_period_end, true);

  // Édition (réutilise si elle existe déjà pour la semaine).
  let editionId: string;
  const { data: existante } = await supabase
    .from("chart_editions")
    .select("id")
    .eq("chart_source_id", source.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();
  if (existante) {
    editionId = existante.id;
    await supabase.from("chart_entries").delete().eq("chart_edition_id", editionId);
    await supabase.from("chart_editions").update({ status: "imported", collected_at: new Date().toISOString() }).eq("id", editionId);
  } else {
    const { data: nouvelle, error } = await supabase
      .from("chart_editions")
      .insert({ chart_source_id: source.id, period_start: periodStart, period_end: periodEnd, status: "imported", collected_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error || !nouvelle) return { ok: false, message: `Création édition échouée : ${error?.message}` };
    editionId = nouvelle.id;
  }

  // Import + entrées.
  await supabase.from("chart_imports").insert({
    chart_source_id: source.id,
    uploaded_by: user.id,
    row_count: rowsBrutes.length,
    valid_row_count: valides.length,
    invalid_row_count: invalides.length,
    status: "processed",
    raw_payload: valides as unknown as object,
  });

  for (const r of valides) {
    const trackId = await resoudreOuCreerTrack(supabase, r.track_title, r.artist_names, r.isrc);
    const platformTrackId = await enregistrerPlatformTrack(supabase, {
      platform: source.platform,
      trackId,
      externalId: r.source_identifier ?? r.source_url ?? `${sourceKey}:${periodStart}:${r.source_position}`,
      title: r.track_title,
      artistText: r.artist_names,
      externalUrl: r.source_url ?? null,
      artworkUrl: r.artwork_url ?? null,
      isrc: r.isrc ?? null,
    });
    await supabase.from("chart_entries").insert({
      chart_edition_id: editionId,
      track_id: trackId,
      platform_track_id: platformTrackId,
      source_position: r.source_position,
      raw_track_title: r.track_title,
      raw_artist_text: r.artist_names,
      metric_value: r.metric_value ?? null,
      metric_unit: r.metric_unit ?? null,
    });
  }

  const { eligibles } = await recomputeEdition(supabase, editionId);
  await logAudit(supabase, { userId: user.id, action: "import_commit", entityType: "chart_edition", entityId: editionId, newValue: { sourceKey, valides: valides.length } });

  return { ok: true, editionId, eligibles, message: `Édition créée (${eligibles} chanson(s) admissible(s)).` };
}

async function chargerEditionAValider(supabase: SupabaseClient, editionId: string) {
  const { data: edition } = await supabase
    .from("chart_editions")
    .select("id, chart_source_id, period_start, period_end, chart_sources(source_key)")
    .eq("id", editionId)
    .single();
  const { data: entries } = await supabase
    .from("chart_entries")
    .select("track_id, filtered_position, source_position")
    .eq("chart_edition_id", editionId)
    .not("filtered_position", "is", null);

  const trackIds = (entries ?? []).map((e) => e.track_id).filter((t): t is string => !!t);
  const verifies = new Set<string>();
  if (trackIds.length) {
    const { data: credits } = await supabase
      .from("track_artists")
      .select("track_id, artists(haitian_status)")
      .in("track_id", trackIds)
      .in("role", ["primary", "co_primary"]);
    (credits ?? []).forEach((c: unknown) => {
      const row = c as { track_id: string; artists: { haitian_status: string } | null };
      if (row.artists && ["verified_haitian", "verified_haitian_diaspora", "verified_haitian_group"].includes(row.artists.haitian_status)) {
        verifies.add(row.track_id);
      }
    });
  }

  const src = edition?.chart_sources as unknown as { source_key: string } | null;
  const aValider: EntreeAValider[] = (entries ?? []).map((e) => ({
    trackId: e.track_id,
    filteredPosition: e.filtered_position as number,
    sourcePosition: e.source_position,
    artisteVerifie: !!(e.track_id && verifies.has(e.track_id)),
    periodStart: edition!.period_start,
  }));

  return {
    edition,
    resultat: validerEdition({
      sourceKey: src?.source_key ?? null,
      periodStart: edition!.period_start,
      periodEnd: edition!.period_end,
      entries: aValider,
    }),
  };
}

export async function validateEditionAction(editionId: string): Promise<{ ok: boolean; erreurs: string[] }> {
  const { user, supabase } = await requireAdmin();
  const { resultat } = await chargerEditionAValider(supabase, editionId);
  if (!resultat.valid) {
    await supabase.from("chart_editions").update({ validation_notes: resultat.erreurs.join(" | ") }).eq("id", editionId);
    return { ok: false, erreurs: resultat.erreurs };
  }
  await supabase.from("chart_editions").update({ status: "validated", validated_at: new Date().toISOString(), validation_notes: null }).eq("id", editionId);
  await logAudit(supabase, { userId: user.id, action: "edition_validate", entityType: "chart_edition", entityId: editionId });
  return { ok: true, erreurs: [] };
}

export async function publishEditionAction(editionId: string): Promise<{ ok: boolean; message: string }> {
  const { user, supabase } = await requireAdmin();
  await recomputeEdition(supabase, editionId);
  const { error } = await supabase
    .from("chart_editions")
    .update({ status: "published", published_at: new Date().toISOString(), is_stale: false })
    .eq("id", editionId);
  if (error) return { ok: false, message: error.message };
  await logAudit(supabase, { userId: user.id, action: "edition_publish", entityType: "chart_edition", entityId: editionId });
  revalidatePath("/charts");
  revalidatePath("/charts/[platform]", "page");
  return { ok: true, message: "Édition publiée." };
}

export async function rollbackEditionAction(editionId: string): Promise<{ ok: boolean; message: string }> {
  const { user, supabase } = await requireAdmin();
  const { data: avant } = await supabase.from("chart_editions").select("status").eq("id", editionId).single();
  const { error } = await supabase
    .from("chart_editions")
    .update({ status: "validated", published_at: null })
    .eq("id", editionId);
  if (error) return { ok: false, message: error.message };
  await logAudit(supabase, { userId: user.id, action: "edition_rollback", entityType: "chart_edition", entityId: editionId, oldValue: avant, newValue: { status: "validated" } });
  revalidatePath("/charts");
  revalidatePath("/charts/[platform]", "page");
  return { ok: true, message: "Publication annulée (retour à validée)." };
}
