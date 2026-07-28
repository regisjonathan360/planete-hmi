import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { PlaylistChartPanel } from "@/components/admin/PlaylistChartPanel";
import { loadPlaylistPanelData } from "@/lib/charts/admin/playlist-panel-data";
import { playlistChartSourcesForTab } from "@/lib/charts/playlist-sources";
import { isSpotifyConfigured } from "@/lib/spotify/api-client";

export const dynamic = "force-dynamic";

export default async function SpotifyAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/spotify");

  const supabase = createAdminClient();
  const sources = playlistChartSourcesForTab("spotify");
  const panels = await Promise.all(
    sources.map((source) => loadPlaylistPanelData(supabase, source)),
  );

  return (
    <>
      <AdminHeader email={user.email} active="spotify" />
      <main className="admin__main">
        <h1 className="admin__title">Spotify — Classement Haïti</h1>
        <p className="admin__subtitle">
          Le classement est construit depuis une playlist Spotify publique. Une playlist donne
          un ordre éditorial, pas des chiffres d&apos;écoute : aucune métrique de streams
          n&apos;est collectée ni affichée.
        </p>

        {!isSpotifyConfigured() && (
          <div className="banner" style={{ marginBottom: "1rem" }}>
            SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET ne sont pas configurés. La collecte
            fonctionne quand même via la page publique de la playlist, mais sans ISRC ni nom
            d&apos;album. Renseignez ces variables pour des métadonnées complètes.
          </div>
        )}

        {panels.map(({ source, chart, state, loadError }) => (
          <div key={source.sourceKey}>
            {loadError && <div className="banner banner--error">{loadError}</div>}
            <PlaylistChartPanel
              sourceKey={source.sourceKey}
              title={source.displayName}
              description={source.description}
              data={chart}
              source={state}
              defaultPlaylistUrl={source.defaultPlaylistUrl}
              publicUrl="/charts/spotify"
            />
          </div>
        ))}
      </main>
    </>
  );
}
