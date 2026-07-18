import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ArtistTopVideo } from "@/components/ArtistTopVideo";
import type { Metadata } from "next";
import "./artist-profile.css";
import "@/components/artist-top-video.css";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("artists")
    .select("name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return {
    title: data ? `${data.name} — Planète HMI` : "Artiste — Planète HMI",
  };
}

const PLATFORM_ICONS: Record<string, { label: string; icon: string }> = {
  url_spotify: { label: "Spotify", icon: "🟢" },
  url_apple_music: { label: "Apple Music", icon: "🍎" },
  url_youtube_music: { label: "YouTube Music", icon: "🔴" },
  url_audiomack: { label: "Audiomack", icon: "🟠" },
  url_deezer: { label: "Deezer", icon: "🟣" },
  url_soundcloud: { label: "SoundCloud", icon: "🟧" },
  url_tidal: { label: "Tidal", icon: "⬛" },
};

const SOCIAL_ICONS: Record<string, { label: string; icon: string }> = {
  url_instagram: { label: "Instagram", icon: "📸" },
  url_tiktok: { label: "TikTok", icon: "🎵" },
  url_twitter: { label: "X / Twitter", icon: "𝕏" },
  url_facebook: { label: "Facebook", icon: "📘" },
  url_youtube: { label: "YouTube", icon: "▶️" },
  url_threads: { label: "Threads", icon: "🔗" },
  url_website: { label: "Site web", icon: "🌐" },
};

export default async function ArtistProfilePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!artist) notFound();

  // Vidéo TikTok la plus populaire de la semaine (si artiste connecté)
  let topVideo: { title: string | null; description: string | null; coverUrl: string | null; embedLink: string | null; shareUrl: string | null; viewCount: number; likeCount: number } | null = null;
  if (artist.user_id) {
    const admin = createAdminClient();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: connection } = await admin
      .from("artist_tiktok_connections")
      .select("id")
      .eq("user_id", artist.user_id)
      .eq("status", "active")
      .maybeSingle();

    if (connection) {
      const { data: video } = await admin
        .from("artist_tiktok_videos")
        .select("title, video_description, cover_image_url, embed_link, share_url, view_count, like_count, create_time")
        .eq("connection_id", connection.id)
        .eq("is_available", true)
        .gte("create_time", oneWeekAgo)
        .order("view_count", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (video) {
        topVideo = {
          title: (video.title as string) ?? null,
          description: (video.video_description as string) ?? null,
          coverUrl: (video.cover_image_url as string) ?? null,
          embedLink: (video.embed_link as string) ?? null,
          shareUrl: (video.share_url as string) ?? null,
          viewCount: video.view_count as number,
          likeCount: video.like_count as number,
        };
      } else {
        // Fallback : vidéo la plus populaire toutes périodes
        const { data: anyVideo } = await admin
          .from("artist_tiktok_videos")
          .select("title, video_description, cover_image_url, embed_link, share_url, view_count, like_count")
          .eq("connection_id", connection.id)
          .eq("is_available", true)
          .order("view_count", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyVideo) {
          topVideo = {
            title: (anyVideo.title as string) ?? null,
            description: (anyVideo.video_description as string) ?? null,
            coverUrl: (anyVideo.cover_image_url as string) ?? null,
            embedLink: (anyVideo.embed_link as string) ?? null,
            shareUrl: (anyVideo.share_url as string) ?? null,
            viewCount: anyVideo.view_count as number,
            likeCount: anyVideo.like_count as number,
          };
        }
      }
    }
  }

  // Classements de l'artiste
  const { data: credits } = await supabase
    .from("track_artists")
    .select("track_id, role")
    .eq("artist_id", artist.id)
    .in("role", ["primary", "co_primary"]);

  const trackIds = (credits ?? []).map((c) => c.track_id as string);
  let chartEntries: { title: string; position: number; genre: string | null }[] = [];

  if (trackIds.length) {
    const { data: entries } = await supabase
      .from("chart_entries")
      .select("raw_track_title, filtered_position, genre, track_id")
      .in("track_id", trackIds)
      .not("filtered_position", "is", null)
      .order("filtered_position", { ascending: true })
      .limit(10);

    chartEntries = (entries ?? []).map((e) => ({
      title: (e.raw_track_title as string) ?? "Sans titre",
      position: e.filtered_position as number,
      genre: (e.genre as string) ?? null,
    }));
  }

  // Plateformes & réseaux
  const platforms = Object.entries(PLATFORM_ICONS)
    .filter(([key]) => artist[key])
    .map(([key, meta]) => ({ url: artist[key] as string, ...meta }));

  const socials = Object.entries(SOCIAL_ICONS)
    .filter(([key]) => artist[key])
    .map(([key, meta]) => ({ url: artist[key] as string, ...meta }));

  const tags: string[] = artist.tags ?? [];

  // Vérifier si le profil est déjà revendiqué
  const isClaimed = !!artist.user_id;
  const hasTikTokUrl = !!artist.url_tiktok;

  return (
    <>
      <SiteHeader />
      <main className="artist-profile">
        {/* Banner */}
        <div
          className="artist-profile__banner"
          style={{
            backgroundImage: artist.banner_url
              ? `url(${artist.banner_url})`
              : "linear-gradient(135deg, #1a1028 0%, #0f0e1a 100%)",
          }}
        />

        {/* Header */}
        <div className="wrap">
          <div className="artist-profile__header">
            <img
              className="artist-profile__avatar"
              src={artist.image_url ?? "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
              alt={artist.name}
              width={140}
              height={140}
            />
            <div className="artist-profile__info">
              <h1 className="artist-profile__name">{artist.name}</h1>
              {tags.length > 0 && (
                <div className="artist-profile__tags">
                  {tags.map((t) => (
                    <span key={t} className="artist-profile__tag">{t}</span>
                  ))}
                </div>
              )}
              {artist.city && <p className="artist-profile__city">📍 {artist.city}</p>}
              {artist.label && <p className="artist-profile__label">🏷️ {artist.label}</p>}
              {artist.bio && <p className="artist-profile__bio">{artist.bio}</p>}
              {/* Bouton revendication TikTok */}
              {!isClaimed && hasTikTokUrl && (
                <a
                  href={`/api/tiktok/connect?claim=${artist.id}`}
                  className="artist-profile__claim-btn"
                >
                  🎵 Revendiquer ce profil avec TikTok
                </a>
              )}
              {isClaimed && (
                <span className="artist-profile__verified-badge">✓ Profil vérifié</span>
              )}
            </div>
          </div>

          {/* Classements */}
          {chartEntries.length > 0 && (
            <section className="artist-profile__section">
              <h2 className="artist-profile__section-title">Classements</h2>
              <div className="artist-profile__chart-list">
                {chartEntries.map((entry, i) => (
                  <div key={i} className="artist-profile__chart-entry">
                    <span className="artist-profile__chart-pos">#{entry.position}</span>
                    <span className="artist-profile__chart-title">{entry.title}</span>
                    {entry.genre && (
                      <span className="artist-profile__chart-genre">{entry.genre}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Vidéo TikTok de la semaine */}
          {topVideo && (
            <section className="artist-profile__section">
              <h2 className="artist-profile__section-title">🔥 Vidéo de la semaine</h2>
              <ArtistTopVideo video={{ ...topVideo, artistName: artist.name as string }} />
            </section>
          )}

          {/* Plateformes musicales */}
          {platforms.length > 0 && (
            <section className="artist-profile__section">
              <h2 className="artist-profile__section-title">Plateformes</h2>
              <div className="artist-profile__links">
                {platforms.map((p) => (
                  <a
                    key={p.label}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="artist-profile__link"
                  >
                    <span className="artist-profile__link-icon">{p.icon}</span>
                    {p.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Réseaux sociaux */}
          {socials.length > 0 && (
            <section className="artist-profile__section">
              <h2 className="artist-profile__section-title">Réseaux</h2>
              <div className="artist-profile__links">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="artist-profile__link"
                  >
                    <span className="artist-profile__link-icon">{s.icon}</span>
                    {s.label}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
