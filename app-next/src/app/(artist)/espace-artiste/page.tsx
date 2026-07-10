import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureArtistAccount } from "@/lib/artists/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isTikTokOAuthConfigured } from "@/lib/tiktok/user-api";
import {
  disconnectTikTokAction,
  signOutArtistAction,
  submitArtistClaimAction,
  syncTikTokAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Espace artiste",
  description: "Compte artiste et connexion TikTok Planet HMI.",
};

export const dynamic = "force-dynamic";

interface TikTokConnectionView {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  profile_deep_link: string | null;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
  scopes: string[];
  status: string;
  last_synced_at: string | null;
}

interface TikTokVideoView {
  video_id: string;
  title: string | null;
  video_description: string | null;
  create_time: string;
  share_url: string | null;
  embed_link: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_available: boolean;
}

const NOTICES: Record<string, { text: string; error?: boolean }> = {
  "tiktok-connected": { text: "Compte TikTok connecte et synchronise." },
  "tiktok-connected-sync-pending": {
    text: "Compte TikTok connecte. La premiere synchronisation sera relancee.",
  },
  "tiktok-synced": { text: "Donnees TikTok actualisees." },
  "tiktok-disconnected": { text: "Connexion TikTok retiree." },
  "claim-submitted": { text: "Demande de validation envoyee." },
  "claim-already-approved": { text: "Ta fiche artiste est deja validee." },
  "tiktok-denied": { text: "L'autorisation TikTok n'a pas ete accordee.", error: true },
  "tiktok-invalid-state": { text: "La tentative de connexion a expire.", error: true },
  "tiktok-missing-code": { text: "TikTok n'a pas termine la connexion.", error: true },
  "tiktok-connect-error": { text: "La connexion TikTok a echoue.", error: true },
  "tiktok-already-linked": {
    text: "Ce compte TikTok est deja lie a un autre compte Planet HMI.",
    error: true,
  },
  "tiktok-sync-error": { text: "Les donnees TikTok n'ont pas pu etre actualisees.", error: true },
  "tiktok-unavailable": { text: "La connexion TikTok n'est pas encore disponible.", error: true },
  "session-expired": { text: "Ta session a expire. Reconnecte-toi.", error: true },
  "claim-invalid": { text: "La fiche artiste selectionnee n'est pas valide.", error: true },
  "claim-error": { text: "La demande de validation n'a pas pu etre envoyee.", error: true },
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function claimLabel(status: string): string {
  if (status === "approved") return "Fiche validee";
  if (status === "pending") return "Validation en cours";
  if (status === "rejected") return "Demande a corriger";
  return "Fiche non revendiquee";
}

export default async function ArtistDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/espace-artiste");

  const account = await ensureArtistAccount(user);
  const admin = createAdminClient();
  const params = await searchParams;
  const notice = params.notice ? NOTICES[params.notice] : undefined;

  const [{ data: connectionData }, { data: artistsData }] = await Promise.all([
    admin
      .from("artist_tiktok_connections")
      .select(
        "id, username, display_name, avatar_url, profile_deep_link, is_verified, follower_count, following_count, likes_count, video_count, scopes, status, last_synced_at"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("artists")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const connection = connectionData as TikTokConnectionView | null;
  let videos: TikTokVideoView[] = [];
  if (connection) {
    const { data } = await admin
      .from("artist_tiktok_videos")
      .select(
        "video_id, title, video_description, create_time, share_url, embed_link, view_count, like_count, comment_count, share_count, is_available"
      )
      .eq("connection_id", connection.id)
      .order("create_time", { ascending: false })
      .limit(20);
    videos = (data ?? []) as TikTokVideoView[];
  }

  const selectedArtist = (artistsData ?? []).find(
    (artist) => artist.id === account.artist_id
  );
  const videoPermission = connection?.scopes.includes("video.list") ?? false;
  const tiktokReady = isTikTokOAuthConfigured();

  return (
    <div className="wrap artist-dashboard">
      <header className="artist-dashboard-header">
        <div>
          <p className="artist-kicker">Espace artiste</p>
          <h1>{account.display_name}</h1>
          <p className="artist-account-email">{account.contact_email}</p>
        </div>
        <form action={signOutArtistAction}>
          <button className="btn btn-ghost" type="submit">
            Se deconnecter
          </button>
        </form>
      </header>

      {notice && (
        <div className={`artist-notice${notice.error ? " is-error" : ""}`} role="status">
          {notice.text}
        </div>
      )}

      <section className="artist-section" aria-labelledby="identity-title">
        <div className="artist-section-heading">
          <div>
            <p className="artist-kicker">Identite Planet HMI</p>
            <h2 id="identity-title">Validation de la fiche</h2>
          </div>
          <span className={`artist-status artist-status--${account.claim_status}`}>
            {claimLabel(account.claim_status)}
          </span>
        </div>

        {account.claim_status === "approved" && selectedArtist ? (
          <p className="artist-section-copy">
            Ce compte est rattache a la fiche <strong>{selectedArtist.name}</strong>.
          </p>
        ) : account.claim_status === "pending" && selectedArtist ? (
          <p className="artist-section-copy">
            La demande pour <strong>{selectedArtist.name}</strong> est en cours de verification.
          </p>
        ) : connection ? (
          <form className="artist-claim-form" action={submitArtistClaimAction}>
            <label htmlFor="artistId">Fiche artiste</label>
            <select id="artistId" name="artistId" defaultValue={account.artist_id ?? ""} required>
              <option value="" disabled>
                Selectionner une fiche
              </option>
              {(artistsData ?? []).map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
            <button className="btn btn-outline" type="submit">
              Envoyer la demande
            </button>
          </form>
        ) : (
          <p className="artist-section-copy">Connecte d&apos;abord ton compte TikTok.</p>
        )}
      </section>

      <section className="artist-section" aria-labelledby="tiktok-title">
        <div className="artist-section-heading">
          <div>
            <p className="artist-kicker">Source officielle</p>
            <h2 id="tiktok-title">Compte TikTok</h2>
          </div>
          {connection && (
            <span className={`artist-status artist-status--${connection.status}`}>
              {connection.status === "active" ? "Connecte" : "A reconnecter"}
            </span>
          )}
        </div>

        {!connection ? (
          <div className="artist-connect-row">
            <p className="artist-section-copy">
              TikTok affichera les autorisations avant la connexion.
            </p>
            {tiktokReady ? (
              <a className="btn btn-primary" href="/api/tiktok/connect">
                Connecter TikTok
              </a>
            ) : (
              <button className="btn btn-primary" type="button" disabled>
                TikTok bientot disponible
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="artist-tiktok-profile">
              <div className="artist-avatar" aria-hidden={!connection.avatar_url}>
                {connection.avatar_url ? (
                  <img src={connection.avatar_url} alt="" width={76} height={76} />
                ) : (
                  <span>{connection.display_name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="artist-tiktok-name">
                <h3>{connection.display_name}</h3>
                <p>{connection.username ? `@${connection.username}` : "Compte TikTok"}</p>
              </div>
              <div className="artist-tiktok-actions">
                {connection.profile_deep_link && (
                  <a
                    className="btn btn-outline"
                    href={connection.profile_deep_link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir le profil
                  </a>
                )}
                <form action={syncTikTokAction}>
                  <button className="btn btn-ghost" type="submit">
                    Actualiser
                  </button>
                </form>
                <form action={disconnectTikTokAction}>
                  <button className="artist-danger-button" type="submit">
                    Retirer TikTok
                  </button>
                </form>
              </div>
            </div>

            <div className="artist-metrics" aria-label="Statistiques du compte TikTok">
              <Metric label="Abonnes" value={connection.follower_count} />
              <Metric label="Abonnements" value={connection.following_count} />
              <Metric label="Likes recus" value={connection.likes_count} />
              <Metric label="Videos" value={connection.video_count} />
            </div>

            <div className="artist-sync-meta">
              <span>Derniere actualisation : {formatDate(connection.last_synced_at)}</span>
              <span>{videoPermission ? "Videos autorisees" : "Autorisation videos manquante"}</span>
            </div>
          </>
        )}
      </section>

      {connection && (
        <section className="artist-section artist-videos-section" aria-labelledby="videos-title">
          <div className="artist-section-heading">
            <div>
              <p className="artist-kicker">Releves TikTok</p>
              <h2 id="videos-title">Videos recentes</h2>
            </div>
            <span className="artist-video-count">{videos.length}</span>
          </div>

          {videos.length === 0 ? (
            <div className="artist-empty-state">
              {videoPermission
                ? "Aucune video publique recue pour le moment."
                : "Reconnecte TikTok pour autoriser la lecture des videos."}
            </div>
          ) : (
            <div className="artist-video-grid">
              {videos.map((video) => {
                const destination = video.share_url ?? video.embed_link;
                return (
                  <article className="artist-video" key={video.video_id}>
                    <div className="artist-video-copy">
                      <h3>{video.title || video.video_description || "Video TikTok"}</h3>
                      <p>{formatDate(video.create_time)}</p>
                    </div>
                    <dl className="artist-video-metrics">
                      <div>
                        <dt>Vues</dt>
                        <dd>{formatCount(video.view_count)}</dd>
                      </div>
                      <div>
                        <dt>Likes</dt>
                        <dd>{formatCount(video.like_count)}</dd>
                      </div>
                      <div>
                        <dt>Commentaires</dt>
                        <dd>{formatCount(video.comment_count)}</dd>
                      </div>
                      <div>
                        <dt>Partages</dt>
                        <dd>{formatCount(video.share_count)}</dd>
                      </div>
                    </dl>
                    {destination && video.is_available && (
                      <a href={destination} target="_blank" rel="noreferrer">
                        Ouvrir sur TikTok
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatCount(value)}</strong>
    </div>
  );
}
