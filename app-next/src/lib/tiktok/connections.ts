import "server-only";

import type { User } from "@supabase/supabase-js";
import { ensureArtistAccount } from "@/lib/artists/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptTikTokToken,
  encryptTikTokToken,
} from "./token-crypto";
import {
  fetchTikTokUserProfile,
  normalizeTikTokScopes,
  revokeTikTokAccessToken,
  type TikTokOAuthTokens,
} from "./user-api";

export class TikTokConnectionConflictError extends Error {
  constructor() {
    super("Ce compte TikTok est deja rattache a un autre compte Planet HMI.");
    this.name = "TikTokConnectionConflictError";
  }
}

function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function connectTikTokAccount(
  user: User,
  tokens: TikTokOAuthTokens
): Promise<string> {
  const account = await ensureArtistAccount(user);
  const supabase = createAdminClient();
  const scopes = normalizeTikTokScopes(tokens.scope);
  const profile = await fetchTikTokUserProfile(tokens.access_token, scopes);

  if (profile.open_id !== tokens.open_id) {
    throw new Error("Le profil TikTok retourne ne correspond pas au jeton OAuth.");
  }

  const { data: sameTikTok, error: conflictReadError } = await supabase
    .from("artist_tiktok_connections")
    .select("user_id")
    .eq("tiktok_open_id", profile.open_id)
    .maybeSingle();

  if (conflictReadError) throw new Error(conflictReadError.message);
  if (sameTikTok && sameTikTok.user_id !== user.id) {
    throw new TikTokConnectionConflictError();
  }

  const { data, error } = await supabase
    .from("artist_tiktok_connections")
    .upsert(
      {
        user_id: user.id,
        artist_id: account.claim_status === "approved" ? account.artist_id : null,
        tiktok_open_id: profile.open_id,
        tiktok_union_id: profile.union_id ?? null,
        username: profile.username ?? null,
        display_name: profile.display_name || account.display_name,
        avatar_url: profile.avatar_url ?? null,
        bio_description: profile.bio_description ?? null,
        profile_deep_link: profile.profile_deep_link ?? null,
        is_verified: profile.is_verified,
        follower_count: profile.follower_count,
        following_count: profile.following_count,
        likes_count: profile.likes_count,
        video_count: profile.video_count,
        scopes,
        access_token_encrypted: encryptTikTokToken(tokens.access_token),
        refresh_token_encrypted: encryptTikTokToken(tokens.refresh_token),
        access_token_expires_at: expiresAt(tokens.expires_in),
        refresh_token_expires_at: expiresAt(tokens.refresh_expires_in),
        status: "active",
        last_sync_error: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new TikTokConnectionConflictError();
    throw new Error(`Enregistrement TikTok impossible: ${error?.message ?? "erreur inconnue"}`);
  }

  return data.id as string;
}

export async function disconnectTikTokAccount(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from("artist_tiktok_connections")
    .select("id, access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!connection) return;

  try {
    const accessToken = decryptTikTokToken(connection.access_token_encrypted as string);
    await revokeTikTokAccessToken(accessToken);
  } catch (revokeError) {
    console.warn("[TikTok OAuth] Revocation distante non confirmee", {
      connectionId: connection.id,
      error: revokeError instanceof Error ? revokeError.message : "erreur inconnue",
    });
  }

  const { error: deleteError } = await supabase
    .from("artist_tiktok_connections")
    .delete()
    .eq("id", connection.id);
  if (deleteError) throw new Error(deleteError.message);
}
