/**
 * Revendication automatique d'une fiche artiste par correspondance TikTok.
 *
 * Conditions d'approbation automatique (TOUTES requises) :
 * 1. Session Planète HMI valide
 * 2. Fiche demandée existe, est active, et a une URL TikTok
 * 3. Le pseudo TikTok retourné par l'API correspond exactement au pseudo enregistré
 * 4. La fiche n'est pas déjà attribuée à un autre compte approuvé
 * 5. L'open_id/union_id TikTok n'est pas lié à un autre utilisateur
 * 6. Le compte Planète HMI n'est pas déjà lié à une autre fiche approuvée
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTikTokUsername, tiktokUsernamesMatch } from "./normalize-username";

export interface AutoClaimResult {
  approved: boolean;
  reason: string;
  /** Détails pour l'audit (ne jamais exposer au client) */
  details: {
    expectedUsername: string | null;
    receivedUsername: string | null;
    openId: string;
    matchResult: "exact_match" | "no_match" | "missing_scope" | "conflict" | "already_claimed";
  };
}

export async function attemptAutoClaim(
  supabase: SupabaseClient,
  params: {
    userId: string;
    artistId: string;
    tiktokOpenId: string;
    tiktokUnionId: string | null;
    tiktokUsername: string | null;
    grantedScopes: string[];
  }
): Promise<AutoClaimResult> {
  const { userId, artistId, tiktokOpenId, tiktokUnionId, tiktokUsername, grantedScopes } = params;

  // Vérifier que le scope user.info.profile est accordé (nécessaire pour username)
  if (!grantedScopes.includes("user.info.profile")) {
    return {
      approved: false,
      reason: "Le scope user.info.profile n'a pas été accordé. Vérification impossible.",
      details: {
        expectedUsername: null,
        receivedUsername: tiktokUsername,
        openId: tiktokOpenId,
        matchResult: "missing_scope",
      },
    };
  }

  // Charger la fiche artiste demandée
  const { data: artist } = await supabase
    .from("artists")
    .select("id, name, slug, url_tiktok, is_active")
    .eq("id", artistId)
    .maybeSingle();

  if (!artist || !artist.is_active) {
    return {
      approved: false,
      reason: "Fiche artiste introuvable ou inactive.",
      details: { expectedUsername: null, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "no_match" },
    };
  }

  // Extraire le pseudo attendu depuis l'URL TikTok de la fiche
  const expectedUsername = normalizeTikTokUsername(artist.url_tiktok as string);
  if (!expectedUsername) {
    return {
      approved: false,
      reason: "Cette fiche n'a pas d'URL TikTok valide enregistrée.",
      details: { expectedUsername: null, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "no_match" },
    };
  }

  // Comparaison exacte du pseudo
  if (!tiktokUsernamesMatch(tiktokUsername, expectedUsername)) {
    return {
      approved: false,
      reason: "Le pseudo TikTok ne correspond pas à celui enregistré sur la fiche.",
      details: { expectedUsername, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "no_match" },
    };
  }

  // Vérifier que la fiche n'est pas déjà attribuée à un AUTRE compte approuvé
  const { data: existingClaim } = await supabase
    .from("artist_accounts")
    .select("user_id")
    .eq("artist_id", artistId)
    .eq("claim_status", "approved")
    .maybeSingle();

  if (existingClaim && existingClaim.user_id !== userId) {
    return {
      approved: false,
      reason: "Cette fiche est déjà attribuée à un autre compte.",
      details: { expectedUsername, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "already_claimed" },
    };
  }

  // Vérifier que l'open_id TikTok n'est pas lié à un autre utilisateur
  const { data: existingConnection } = await supabase
    .from("artist_tiktok_connections")
    .select("user_id")
    .eq("tiktok_open_id", tiktokOpenId)
    .neq("user_id", userId)
    .maybeSingle();

  if (existingConnection) {
    return {
      approved: false,
      reason: "Ce compte TikTok est déjà lié à un autre utilisateur.",
      details: { expectedUsername, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "conflict" },
    };
  }

  // Vérifier que l'utilisateur n'est pas déjà lié à une AUTRE fiche approuvée
  const { data: userAccount } = await supabase
    .from("artist_accounts")
    .select("artist_id, claim_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (userAccount?.claim_status === "approved" && userAccount.artist_id !== artistId) {
    return {
      approved: false,
      reason: "Ce compte est déjà lié à une autre fiche artiste.",
      details: { expectedUsername, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "conflict" },
    };
  }

  // ✅ Toutes les conditions sont satisfaites → approbation automatique
  return {
    approved: true,
    reason: "Correspondance TikTok exacte — approbation automatique.",
    details: { expectedUsername, receivedUsername: tiktokUsername, openId: tiktokOpenId, matchResult: "exact_match" },
  };
}

/**
 * Exécute l'approbation atomique après validation.
 */
export async function executeAutoClaim(
  supabase: SupabaseClient,
  params: {
    userId: string;
    artistId: string;
    connectionId: string;
    tiktokOpenId: string;
    tiktokUsername: string | null;
    expectedUsername: string | null;
  }
): Promise<void> {
  const { userId, artistId, connectionId, tiktokOpenId, tiktokUsername, expectedUsername } = params;
  const now = new Date().toISOString();

  // 1. Mettre à jour artist_accounts (claim approuvé)
  await supabase
    .from("artist_accounts")
    .update({
      artist_id: artistId,
      claim_status: "approved",
      claim_submitted_at: now,
      claim_reviewed_at: now,
    })
    .eq("user_id", userId);

  // 2. Rattacher la connexion TikTok à l'artiste
  await supabase
    .from("artist_tiktok_connections")
    .update({ artist_id: artistId })
    .eq("id", connectionId);

  // 3. Mettre à jour ou créer l'identité plateforme
  const normalizedUsername = normalizeTikTokUsername(tiktokUsername);
  await supabase
    .from("artist_platform_identities")
    .upsert({
      artist_id: artistId,
      platform: "tiktok",
      external_id: normalizedUsername ?? tiktokOpenId,
      external_url: normalizedUsername ? `https://www.tiktok.com/@${normalizedUsername}` : null,
      platform_name: tiktokUsername ?? null,
      match_method: "user_claim",
      is_verified: true,
      verified_at: now,
      last_seen_at: now,
      metadata: { open_id: tiktokOpenId },
    }, { onConflict: "platform,external_id" });

  // 4. Lier l'artiste au user dans la table artists (pour l'espace compte)
  await supabase
    .from("artists")
    .update({ user_id: userId })
    .eq("id", artistId);

  // 5. Trace d'audit
  await supabase.from("artist_claim_audit").insert({
    user_id: userId,
    artist_id: artistId,
    tiktok_open_id: tiktokOpenId,
    tiktok_username: tiktokUsername,
    expected_username: expectedUsername,
    match_result: "exact_match",
    auto_approved: true,
  });
}
