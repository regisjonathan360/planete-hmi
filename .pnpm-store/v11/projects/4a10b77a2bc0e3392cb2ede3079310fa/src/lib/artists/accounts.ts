import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ArtistAccount {
  user_id: string;
  artist_id: string | null;
  contact_email: string | null;
  display_name: string;
  claim_status: "unsubmitted" | "pending" | "approved" | "rejected";
  claim_submitted_at: string | null;
  claim_reviewed_at: string | null;
}

function displayNameFromUser(user: User): string {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().slice(0, 120);
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return (emailName || "Artiste Planet HMI").slice(0, 120);
}

export async function ensureArtistAccount(user: User): Promise<ArtistAccount> {
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("artist_accounts")
    .select(
      "user_id, artist_id, contact_email, display_name, claim_status, claim_submitted_at, claim_reviewed_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw new Error(`Lecture du compte artiste impossible: ${readError.message}`);
  if (existing) return existing as ArtistAccount;

  const payload = {
    user_id: user.id,
    contact_email: user.email ?? null,
    display_name: displayNameFromUser(user),
  };

  const { data, error } = await supabase
    .from("artist_accounts")
    .insert(payload)
    .select(
      "user_id, artist_id, contact_email, display_name, claim_status, claim_submitted_at, claim_reviewed_at"
    )
    .single();

  if (!error && data) return data as ArtistAccount;

  // Deux requetes simultanees peuvent tenter de creer le meme compte.
  if (error?.code === "23505") {
    const { data: racedAccount, error: racedError } = await supabase
      .from("artist_accounts")
      .select(
        "user_id, artist_id, contact_email, display_name, claim_status, claim_submitted_at, claim_reviewed_at"
      )
      .eq("user_id", user.id)
      .single();

    if (!racedError && racedAccount) return racedAccount as ArtistAccount;
  }

  throw new Error(`Creation du compte artiste impossible: ${error?.message ?? "erreur inconnue"}`);
}
