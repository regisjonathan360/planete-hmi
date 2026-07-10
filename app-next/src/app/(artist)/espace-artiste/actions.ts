"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureArtistAccount } from "@/lib/artists/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { disconnectTikTokAccount } from "@/lib/tiktok/connections";
import { syncTikTokConnection } from "@/lib/tiktok/user-sync";

const artistIdSchema = z.string().uuid();

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/espace-artiste");
  return { user, supabase };
}

export async function signOutArtistAction() {
  const { supabase } = await authenticatedUser();
  await supabase.auth.signOut();
  redirect("/connexion?notice=signed-out");
}

export async function submitArtistClaimAction(formData: FormData) {
  const { user } = await authenticatedUser();
  const parsedArtistId = artistIdSchema.safeParse(formData.get("artistId"));
  if (!parsedArtistId.success) {
    redirect("/espace-artiste?notice=claim-invalid");
  }

  const account = await ensureArtistAccount(user);
  if (account.claim_status === "approved") {
    redirect("/espace-artiste?notice=claim-already-approved");
  }

  const admin = createAdminClient();
  const { data: artist, error: artistError } = await admin
    .from("artists")
    .select("id")
    .eq("id", parsedArtistId.data)
    .eq("is_active", true)
    .maybeSingle();

  if (artistError || !artist) redirect("/espace-artiste?notice=claim-invalid");

  const { error } = await admin
    .from("artist_accounts")
    .update({
      artist_id: parsedArtistId.data,
      claim_status: "pending",
      claim_submitted_at: new Date().toISOString(),
      claim_reviewed_at: null,
      claim_reviewed_by: null,
    })
    .eq("user_id", user.id);

  if (error) redirect("/espace-artiste?notice=claim-error");
  revalidatePath("/espace-artiste");
  redirect("/espace-artiste?notice=claim-submitted");
}

export async function syncTikTokAction() {
  const { user } = await authenticatedUser();
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("artist_tiktok_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) redirect("/espace-artiste?notice=tiktok-not-connected");
  const result = await syncTikTokConnection(connection.id as string);
  revalidatePath("/espace-artiste");
  redirect(
    result.ok
      ? "/espace-artiste?notice=tiktok-synced"
      : "/espace-artiste?notice=tiktok-sync-error"
  );
}

export async function disconnectTikTokAction() {
  const { user } = await authenticatedUser();
  await disconnectTikTokAccount(user.id);
  revalidatePath("/espace-artiste");
  redirect("/espace-artiste?notice=tiktok-disconnected");
}
