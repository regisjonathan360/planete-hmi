import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { TikTokManager } from "./TikTokManager";
import type { PendingArtistClaim } from "./ArtistConnectionsQueue";

export const dynamic = "force-dynamic";

export default async function TikTokAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/tiktok");

  const supabase = createAdminClient();

  // Load initial data
  // 1. Stats: total sounds, pending validation, validated, last sync run
  const [
    { count: totalSounds },
    { count: pendingSounds },
    { count: validatedSounds },
    { data: lastSyncRun },
    { data: latestEdition },
    { count: connectedArtists },
    { data: pendingClaims },
  ] = await Promise.all([
    supabase.from("tiktok_sounds").select("*", { count: "exact", head: true }),
    supabase
      .from("tiktok_sounds")
      .select("*", { count: "exact", head: true })
      .eq("validation_status", "a_verifier"),
    supabase
      .from("tiktok_sounds")
      .select("*", { count: "exact", head: true })
      .eq("validation_status", "valide"),
    supabase
      .from("sync_runs")
      .select("*")
      .eq("platform", "tiktok")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chart_editions")
      .select("*, chart_sources!inner(source_key)")
      .eq("chart_sources.source_key", "tiktok_haiti_global")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("artist_tiktok_connections")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("artist_accounts")
      .select("user_id, artist_id, display_name, contact_email, claim_submitted_at")
      .eq("claim_status", "pending")
      .order("claim_submitted_at", { ascending: true }),
  ]);

  const pendingUserIds = (pendingClaims ?? []).map((claim) => claim.user_id as string);
  const pendingArtistIds = (pendingClaims ?? [])
    .map((claim) => claim.artist_id as string | null)
    .filter((artistId): artistId is string => Boolean(artistId));

  const [{ data: claimArtists }, { data: claimConnections }] = await Promise.all([
    pendingArtistIds.length
      ? supabase.from("artists").select("id, name, slug").in("id", pendingArtistIds)
      : Promise.resolve({ data: [] }),
    pendingUserIds.length
      ? supabase
          .from("artist_tiktok_connections")
          .select("user_id, display_name, username, profile_deep_link, is_verified")
          .in("user_id", pendingUserIds)
      : Promise.resolve({ data: [] }),
  ]);

  const artistsById = new Map(
    (claimArtists ?? []).map((artist) => [artist.id as string, artist])
  );
  const connectionsByUserId = new Map(
    (claimConnections ?? []).map((connection) => [connection.user_id as string, connection])
  );
  const pendingArtistClaims: PendingArtistClaim[] = (pendingClaims ?? [])
    .map((claim) => {
      const artist = artistsById.get(claim.artist_id as string);
      if (!artist) return null;
      const connection = connectionsByUserId.get(claim.user_id as string);
      return {
        userId: claim.user_id as string,
        displayName: claim.display_name as string,
        contactEmail: (claim.contact_email as string | null) ?? null,
        submittedAt: (claim.claim_submitted_at as string | null) ?? null,
        artistName: artist.name as string,
        artistSlug: artist.slug as string,
        tiktokDisplayName: (connection?.display_name as string | null) ?? null,
        tiktokUsername: (connection?.username as string | null) ?? null,
        tiktokProfileUrl: (connection?.profile_deep_link as string | null) ?? null,
        tiktokVerified: Boolean(connection?.is_verified),
      };
    })
    .filter((claim): claim is PendingArtistClaim => claim !== null);

  const initialData = {
    stats: {
      totalSounds: totalSounds ?? 0,
      pendingSounds: pendingSounds ?? 0,
      validatedSounds: validatedSounds ?? 0,
      lastSyncRun,
      latestEdition,
      connectedArtists: connectedArtists ?? 0,
      pendingArtistClaims,
    },
  };

  return (
    <>
      <AdminHeader email={user.email} active="tiktok" />
      <main className="admin__main">
        <h1 className="admin__title">TikTok — Classements Haiti</h1>
        <p className="admin__subtitle">
          Gestion des classements TikTok : collecte, validation des sons,
          édition manuelle et publication.
        </p>
        <TikTokManager initialData={initialData} />
      </main>
    </>
  );
}
