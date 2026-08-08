import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { ArtistList } from "./ArtistList";

export const dynamic = "force-dynamic";

export default async function AdminArtistesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/artistes");

  const { filter } = await searchParams;
  const supabase = createAdminClient();
  const [
    { data: artists, error: artistsError },
    { data: approvedAccounts, error: accountsError },
  ] = await Promise.all([
    supabase
      .from("artists")
      .select(`
        id, name, slug, image_url, banner_url, bio, haitian_status, is_active, is_excluded,
        exclusion_reason, excluded_at, artist_type,
        tags, primary_genre, city, birth_place, birth_date, user_id,
        url_youtube, url_youtube_music, url_deezer, url_spotify, url_audiomack,
        url_apple_music, url_soundcloud, url_tidal, url_tiktok, url_instagram,
        url_facebook, url_twitter, url_threads, url_website, created_at, updated_at
      `)
      .order("name"),
    supabase
      .from("artist_accounts")
      .select("artist_id")
      .eq("claim_status", "approved")
      .not("artist_id", "is", null),
  ]);

  if (artistsError) throw new Error(`Impossible de charger les artistes: ${artistsError.message}`);
  if (accountsError) throw new Error(`Impossible de synchroniser les revendications: ${accountsError.message}`);

  const claimedArtistIds = new Set(
    (approvedAccounts ?? []).map((account) => account.artist_id as string)
  );
  const synchronizedArtists = (artists ?? []).map((artist) => ({
    ...artist,
    is_claimed: Boolean(artist.user_id) || claimedArtistIds.has(artist.id),
  }));
  const includedArtistCount = synchronizedArtists.filter((artist) => !artist.is_excluded).length;

  return (
    <>
      <AdminHeader email={user.email} active="artistes" />
      <main className="admin__main">
        <h1 className="admin__title">Gestion des artistes</h1>
        <p className="admin__subtitle">
          {includedArtistCount} artistes inclus. Les artistes exclus disposent de leur propre liste et ne sont comptés nulle part ailleurs.
        </p>
        <ArtistList artists={synchronizedArtists} initialFilter={filter === "excluded" ? "excluded" : "all"} />
      </main>
    </>
  );
}
