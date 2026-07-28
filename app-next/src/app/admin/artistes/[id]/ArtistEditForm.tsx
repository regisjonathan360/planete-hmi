"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ARTIST_TAGS } from "@/lib/artists/tags";
import {
  roleTagForArtistType,
  synchronizeArtistRoleFields,
  type ArtistType,
} from "@/lib/artists/roles";
import {
  ARTIST_METRIC_KEYS,
  type ArtistMetricKey,
  type ArtistMetricSummary,
} from "@/lib/artists/artist-metrics";

const ADDITIONAL_ROLES = [
  { id: "arrangeur", label: "Arrangeur" },
  { id: "ingenieur_son", label: "Ingénieur du son" },
] as const;

const ROLE_OPTIONS = [
  ...ARTIST_TAGS.map(({ id, label }) => ({ id, label })),
  ...ADDITIONAL_ROLES,
];

const STATUSES = [
  { value: "verified_haitian", label: "Vérifié haïtien" },
  { value: "verified_haitian_diaspora", label: "Vérifié diaspora" },
  { value: "verified_haitian_group", label: "Vérifié groupe" },
  { value: "pending_review", label: "À vérifier" },
  { value: "rejected", label: "Refusé" },
];

export function ArtistEditForm({
  artist,
  departments = [],
  communes = [],
}: {
  artist: Record<string, unknown>;
  departments?: { id: string; name: string; code: string }[];
  communes?: { id: string; department_id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "warning" | "error";
  } | null>(null);

  const [form, setForm] = useState({
    name: (artist.name as string) ?? "",
    slug: (artist.slug as string) ?? "",
    bio: (artist.bio as string) ?? "",
    city: (artist.city as string) ?? "",
    birth_place: (artist.birth_place as string) ?? "",
    birth_city: (artist.birth_city as string) ?? "",
    birth_department_id: (artist.birth_department_id as string) ?? "",
    birth_commune_id: (artist.birth_commune_id as string) ?? "",
    artist_type: (artist.artist_type as string) ?? "artist",
    label: (artist.label as string) ?? "",
    primary_genre: (artist.primary_genre as string) ?? "",
    real_name: (artist.real_name as string) ?? "",
    career_start_year: (artist.career_start_year as number)?.toString() ?? "",
    birth_date: (artist.birth_date as string) ?? "",
    haitian_status: (artist.haitian_status as string) ?? "pending_review",
    is_active: (artist.is_active as boolean) ?? true,
    tags: (artist.tags as string[]) ?? [],
    image_url: (artist.image_url as string) ?? "",
    banner_url: (artist.banner_url as string) ?? "",
    url_spotify: (artist.url_spotify as string) ?? "",
    url_apple_music: (artist.url_apple_music as string) ?? "",
    url_youtube_music: (artist.url_youtube_music as string) ?? "",
    url_audiomack: (artist.url_audiomack as string) ?? "",
    url_deezer: (artist.url_deezer as string) ?? "",
    url_soundcloud: (artist.url_soundcloud as string) ?? "",
    url_tidal: (artist.url_tidal as string) ?? "",
    url_instagram: (artist.url_instagram as string) ?? "",
    url_tiktok: (artist.url_tiktok as string) ?? "",
    url_twitter: (artist.url_twitter as string) ?? "",
    url_facebook: (artist.url_facebook as string) ?? "",
    url_youtube: (artist.url_youtube as string) ?? "",
    url_threads: (artist.url_threads as string) ?? "",
    url_website: (artist.url_website as string) ?? "",
  });

  function update(field: string, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tag: string) {
    setForm((prev) => {
      const removing = prev.tags.includes(tag);
      const tags = removing ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag];
      const currentType = prev.artist_type as ArtistType;
      const typeWithoutRemovedPrimary =
        removing && roleTagForArtistType(currentType) === tag ? "artist" : currentType;
      const synced = synchronizeArtistRoleFields(typeWithoutRemovedPrimary, tags);
      return { ...prev, tags: synced.tags, artist_type: synced.artistType };
    });
  }

  function changeArtistType(value: string) {
    const synced = synchronizeArtistRoleFields(value as ArtistType, form.tags);
    setForm((prev) => ({
      ...prev,
      artist_type: synced.artistType,
      tags: synced.tags,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/artistes/${artist.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ text: json.error ?? "Erreur.", tone: "error" });
      } else {
        setMessage({
          text: json.youtubeSyncWarning
            ? `Artiste mis à jour. ${json.youtubeSyncWarning}`
            : json.youtubeSync?.created > 0
              ? "Artiste mis à jour. Sa chaîne YouTube a été ajoutée à la file de vérification."
              : "Artiste mis à jour.",
          tone: json.youtubeSyncWarning ? "warning" : "success",
        });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Erreur réseau.", tone: "error" });
    }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <img
          src={form.image_url || "/image/artists/planet-hmi-artist-placeholder-square.webp.webp"}
          alt="" width={60} height={60} style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <h1 className="admin__title" style={{ margin: 0 }}>{form.name || "Nouvel artiste"}</h1>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.82rem", margin: 0 }}>/{form.slug}</p>
        </div>
      </div>

      {/* Identité */}
      <Fieldset title="Identité">
        <Row><Field label="Nom public" value={form.name} onChange={(v) => update("name", v)} /></Row>
        <Row><Field label="Slug (URL)" value={form.slug} onChange={(v) => update("slug", v)} /></Row>
        <Row>
          <Field label="Biographie" value={form.bio} onChange={(v) => update("bio", v)} textarea />
        </Row>
        <Row>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
            <span style={labelStyle}>Département de naissance</span>
            <select
              value={form.birth_department_id}
              onChange={(e) => {
                update("birth_department_id", e.target.value);
                update("birth_commune_id", "");
              }}
              style={inputStyle}
            >
              <option value="">— Aucun —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
            <span style={labelStyle}>Commune de naissance</span>
            <select
              value={form.birth_commune_id}
              onChange={(e) => update("birth_commune_id", e.target.value)}
              style={inputStyle}
              disabled={!form.birth_department_id}
            >
              <option value="">— Aucune —</option>
              {communes
                .filter((c) => c.department_id === form.birth_department_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </label>
          <Field label="Ville ou localisation actuelle" value={form.city} onChange={(v) => update("city", v)} />
        </Row>
        <Row>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
            <span style={labelStyle}>Type d&apos;artiste</span>
            <select value={form.artist_type} onChange={(e) => changeArtistType(e.target.value)} style={inputStyle}>
              <option value="artist">Artiste (solo)</option>
              <option value="group">Groupe / Orchestre</option>
              <option value="producer">Producteur</option>
              <option value="beatmaker">Beatmaker</option>
              <option value="dj">DJ</option>
              <option value="musician">Musicien</option>
              <option value="singer">Chanteur / Chanteuse</option>
              <option value="rapper">Rappeur / Rappeuse</option>
            </select>
          </label>
        </Row>
        <Row>
          <Field label="Label / Collectif" value={form.label} onChange={(v) => update("label", v)} />
          <Field label="Genre principal" value={form.primary_genre} onChange={(v) => update("primary_genre", v)} />
        </Row>
        <Row>
          <Field label="Nom réel (privé)" value={form.real_name} onChange={(v) => update("real_name", v)} />
          <Field label="Date de naissance (privé)" value={form.birth_date} onChange={(v) => update("birth_date", v)} type="date" />
        </Row>
        <Row><Field label="Année de début de carrière" value={form.career_start_year} onChange={(v) => update("career_start_year", v)} /></Row>
      </Fieldset>

      {/* Statut */}
      <Fieldset title="Statut & visibilité">
        <Row>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
            <span style={labelStyle}>Statut haïtien</span>
            <select value={form.haitian_status} onChange={(e) => update("haitian_status", e.target.value)} style={inputStyle}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} />
            <span style={labelStyle}>Profil actif (visible publiquement)</span>
          </label>
        </Row>
      </Fieldset>

      {/* Rôles */}
      <Fieldset title="Rôles / Étiquettes">
        <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", marginTop: 0 }}>
          Le type principal et les catégories publiques sont synchronisés automatiquement avec ces rôles.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => toggleTag(role.id)}
              className="btn btn--sm"
              style={{
                background: form.tags.includes(role.id) ? "var(--admin-accent)" : "transparent",
                borderColor: form.tags.includes(role.id) ? "var(--admin-accent)" : "var(--admin-border)",
                color: form.tags.includes(role.id) ? "#fff" : "var(--admin-muted)",
              }}
            >
              {role.label}
            </button>
          ))}
        </div>
      </Fieldset>

      {/* Images */}
      <Fieldset title="Images">
        <Row>
          <Field label="Photo de profil (URL)" value={form.image_url} onChange={(v) => update("image_url", v)} />
          <Field label="Bannière (URL)" value={form.banner_url} onChange={(v) => update("banner_url", v)} />
        </Row>
      </Fieldset>

      {/* Plateformes */}
      <Fieldset title="Plateformes musicales">
        <Row><Field label="Spotify" value={form.url_spotify} onChange={(v) => update("url_spotify", v)} /></Row>
        <Row><Field label="Apple Music" value={form.url_apple_music} onChange={(v) => update("url_apple_music", v)} /></Row>
        <Row><Field label="YouTube Music" value={form.url_youtube_music} onChange={(v) => update("url_youtube_music", v)} /></Row>
        <Row><Field label="Audiomack" value={form.url_audiomack} onChange={(v) => update("url_audiomack", v)} /></Row>
        <Row><Field label="Deezer" value={form.url_deezer} onChange={(v) => update("url_deezer", v)} /></Row>
        <Row><Field label="SoundCloud" value={form.url_soundcloud} onChange={(v) => update("url_soundcloud", v)} /></Row>
        <Row><Field label="Tidal" value={form.url_tidal} onChange={(v) => update("url_tidal", v)} /></Row>
      </Fieldset>

      {/* Réseaux */}
      <Fieldset title="Réseaux sociaux">
        <Row><Field label="Instagram" value={form.url_instagram} onChange={(v) => update("url_instagram", v)} /></Row>
        <Row><Field label="TikTok" value={form.url_tiktok} onChange={(v) => update("url_tiktok", v)} /></Row>
        <Row><Field label="X / Twitter" value={form.url_twitter} onChange={(v) => update("url_twitter", v)} /></Row>
        <Row><Field label="Facebook" value={form.url_facebook} onChange={(v) => update("url_facebook", v)} /></Row>
        <Row><Field label="YouTube" value={form.url_youtube} onChange={(v) => update("url_youtube", v)} /></Row>
        <Row><Field label="Threads" value={form.url_threads} onChange={(v) => update("url_threads", v)} /></Row>
        <Row><Field label="Site web" value={form.url_website} onChange={(v) => update("url_website", v)} /></Row>
      </Fieldset>

      {/* Enrichissement multi-plateforme */}
      <Fieldset title="Enrichissement automatique">
        <EnrichmentPanel
          artistId={artist.id as string}
          urls={{
            url_spotify: form.url_spotify,
            url_deezer: form.url_deezer,
            url_youtube: form.url_youtube,
            url_youtube_music: form.url_youtube_music,
            url_audiomack: form.url_audiomack,
            url_apple_music: form.url_apple_music,
            url_soundcloud: form.url_soundcloud,
            url_tidal: form.url_tidal,
            url_instagram: form.url_instagram,
            url_tiktok: form.url_tiktok,
            url_facebook: form.url_facebook,
            url_twitter: form.url_twitter,
            url_threads: form.url_threads,
            url_website: form.url_website,
          }}
        />
      </Fieldset>

      {message ? (
        <p
          role="status"
          style={{
            marginTop: "1rem",
            color:
              message.tone === "success"
                ? "var(--admin-ok)"
                : message.tone === "warning"
                  ? "var(--admin-warn)"
                  : "var(--admin-danger)",
          }}
        >
          {message.text}
        </p>
      ) : null}

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => router.back()}>
          Retour
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: "var(--admin-muted)" };
const inputStyle: React.CSSProperties = {
  background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
  color: "var(--admin-text)", padding: "0.5rem 0.7rem", borderRadius: "8px", fontSize: "0.88rem", width: "100%",
};

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid var(--admin-border)", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.25rem" }}>
      <legend style={{ fontWeight: 700, fontSize: "0.88rem", padding: "0 0.5rem" }}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>{children}</div>;
}

function Field({ label, value, onChange, textarea, type }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 180 }}>
      <span style={labelStyle}>{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
      ) : (
        <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </label>
  );
}

// ---------- Panneau de collecte par plateforme ----------

interface CollectedImage {
  url: string;
  label: string;
  type: "avatar" | "banner" | "cover";
}

interface FieldResult {
  platform: string;
  name: string | null;
  description: string | null;
  images: CollectedImage[];
  monthlyListeners: number | null;
  followers: number | null;
  subscriberCount: number | null;
  totalViews: number | null;
  genres: string[];
  albumCount: number | null;
  trackCount: number | null;
  popularity: number | null;
  details: Record<string, string | number | boolean | string[] | null>;
  method: string;
  warnings: string[];
  error: string | null;
  fetchedAt: string;
}

function formatBigNumber(n: number | null): string {
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  const absolute = Math.abs(n);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(0)}k`;
  return String(n);
}

function hasUsableResult(data: FieldResult): boolean {
  const hasSpecificName = Boolean(
    data.name &&
    !(data.platform === "instagram" && data.name.trim().toLowerCase() === "instagram"),
  );
  return Boolean(
    hasSpecificName ||
    data.description ||
    data.images.length ||
    data.genres.length ||
    data.monthlyListeners !== null ||
    data.followers !== null ||
    data.subscriberCount !== null ||
    data.totalViews !== null ||
    data.popularity !== null ||
    data.albumCount !== null ||
    data.trackCount !== null
  );
}

const COLLECTION_METHOD_LABELS: Record<string, string> = {
  none: "Aucune donnée disponible",
  web_api: "API officielle Spotify",
  spotify_oembed: "Profil public Spotify (oEmbed)",
  embed: "Page publique Spotify",
  embed_metadata: "Ancienne lecture de page Spotify (limitée)",
  page_metadata: "Métadonnées publiques de la page (limitées)",
  youtube_data_api: "API officielle YouTube Data",
  youtube_channel_registry: "Chaîne YouTube approuvée dans l'administration",
  public_api: "API publique officielle",
  oembed: "Métadonnées publiques oEmbed",
};

function formatCollectionMethod(method: string): string {
  return method
    .split("+")
    .map((part) => COLLECTION_METHOD_LABELS[part] ?? part)
    .join(" + ");
}

const FIELD_LABELS: Record<string, { label: string; icon: string }> = {
  url_spotify: { label: "Spotify", icon: "🟢" },
  url_deezer: { label: "Deezer", icon: "🎵" },
  url_youtube: { label: "YouTube", icon: "▶️" },
  url_youtube_music: { label: "YouTube Music", icon: "🎶" },
  url_audiomack: { label: "Audiomack", icon: "🔊" },
  url_apple_music: { label: "Apple Music", icon: "🎧" },
  url_soundcloud: { label: "SoundCloud", icon: "☁️" },
  url_tidal: { label: "TIDAL", icon: "🌊" },
  url_instagram: { label: "Instagram", icon: "📸" },
  url_tiktok: { label: "TikTok", icon: "🎬" },
  url_facebook: { label: "Facebook", icon: "🔵" },
  url_twitter: { label: "X", icon: "✕" },
  url_threads: { label: "Threads", icon: "@" },
  url_website: { label: "Site officiel", icon: "🌐" },
};

const METRIC_LABELS: Record<ArtistMetricKey, { label: string; icon: string }> = {
  monthlyListeners: { label: "Auditeurs mensuels", icon: "🎧" },
  followers: { label: "Followers / Fans", icon: "👥" },
  subscriberCount: { label: "Abonnés", icon: "📺" },
  totalViews: { label: "Vues totales", icon: "👁" },
  popularity: { label: "Popularité", icon: "★" },
  albumCount: { label: "Albums", icon: "💿" },
  trackCount: { label: "Titres / Vidéos", icon: "🎵" },
};

function formatMetricValue(key: ArtistMetricKey, value: number): string {
  return key === "popularity" ? `${value}/100` : formatBigNumber(value);
}

function formatMetricDelta(key: ArtistMetricKey, value: number): string {
  return key === "popularity" ? `${value} point(s)` : formatBigNumber(value);
}

function MetricsSection({ summaries }: { summaries: ArtistMetricSummary[] }) {
  return (
    <section
      style={{
        border: "1px solid var(--admin-border)",
        borderRadius: 12,
        padding: "0.85rem",
        marginBottom: "1rem",
        background: "var(--admin-panel-2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: "0.92rem" }}>Indicateurs enregistrés</strong>
          <p style={{ color: "var(--admin-muted)", fontSize: "0.72rem", margin: "0.2rem 0 0" }}>
            Valeurs actuelles et évolution depuis le relevé précédent.
          </p>
        </div>
        <span className="badge" style={{ alignSelf: "flex-start" }}>
          {summaries.length} plateforme(s)
        </span>
      </div>

      {!summaries.length ? (
        <p style={{ color: "var(--admin-muted)", fontSize: "0.78rem", margin: "0.8rem 0 0" }}>
          Aucun indicateur enregistré. Lancez une collecte pour créer le premier relevé.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(245px, 1fr))",
            gap: "0.65rem",
            marginTop: "0.8rem",
          }}
        >
          {summaries.map((summary) => {
            const platform = FIELD_LABELS[summary.sourceField] ?? {
              label: summary.platform,
              icon: "📊",
            };
            return (
              <article
                key={summary.platform}
                style={{
                  border: "1px solid var(--admin-border)",
                  borderRadius: 10,
                  padding: "0.7rem",
                  background: "var(--admin-panel)",
                }}
              >
                <strong style={{ fontSize: "0.82rem" }}>
                  {platform.icon} {platform.label}
                </strong>
                <div style={{ display: "grid", gap: "0.38rem", marginTop: "0.55rem" }}>
                  {ARTIST_METRIC_KEYS.map((key) => {
                    const value = summary.latest.values[key];
                    if (value === null) return null;
                    const delta = summary.deltas[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <span style={{ color: "var(--admin-muted)" }}>
                          {METRIC_LABELS[key].icon} {METRIC_LABELS[key].label}
                        </span>
                        <span style={{ textAlign: "right" }}>
                          <strong>{formatMetricValue(key, value)}</strong>
                          {delta !== null && delta !== 0 ? (
                            <small
                              style={{
                                display: "block",
                                color: delta > 0 ? "var(--admin-ok)" : "var(--admin-warn)",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {formatMetricDelta(key, delta)}
                            </small>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ color: "var(--admin-muted)", fontSize: "0.66rem", margin: "0.6rem 0 0" }}>
                  Relevé le {new Date(summary.latest.collectedAt).toLocaleString("fr")}
                  {summary.previous ? " · comparaison disponible" : " · premier relevé"}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EnrichmentPanel({
  artistId,
  urls,
}: {
  artistId: string;
  urls: Record<string, string>;
}) {
  const router = useRouter();
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, FieldResult>>({});
  const [metricSummaries, setMetricSummaries] = useState<ArtistMetricSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch(`/api/admin/artistes/${artistId}/enrich`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Historique indisponible.");
        if (active) {
          setResults(json.results ?? {});
          setMetricSummaries(json.metricSummaries ?? []);
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) {
          setToast(`❌ ${error instanceof Error ? error.message : "Historique indisponible."}`);
        }
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [artistId]);

  const availableFields = Object.keys(FIELD_LABELS).filter((field) => Boolean(urls[field]?.trim()));

  async function collectField(field: string) {
    setLoadingField(field);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/artistes/${artistId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, url: urls[field] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast(`❌ ${json.error ?? "Erreur."}`);
        return;
      }
      setResults((prev) => ({ ...prev, [field]: json as FieldResult }));
      setMetricSummaries(json.metricSummaries ?? []);
      if (json.error) {
        setToast(`⚠ ${FIELD_LABELS[field]?.label ?? field} : ${json.error}`);
      } else if (!hasUsableResult(json as FieldResult)) {
        setToast(`⚠ ${FIELD_LABELS[field]?.label ?? field} : aucune donnée exploitable reçue.`);
      } else {
        setToast(`✓ ${FIELD_LABELS[field]?.label ?? field} : données collectées.`);
      }
      router.refresh();
    } catch {
      setToast("❌ Erreur réseau.");
    } finally {
      setLoadingField(null);
    }
  }

  async function collectAllFields() {
    setLoadingField("all");
    setToast(null);
    try {
      const response = await fetch(`/api/admin/artistes/${artistId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "all", urls }),
      });
      const json = await response.json();
      if (!response.ok) {
        setToast(`❌ ${json.error ?? "Collecte impossible."}`);
        return;
      }
      setResults((previous) => ({ ...previous, ...(json.results ?? {}) }));
      setMetricSummaries(json.metricSummaries ?? []);
      const total = Object.keys(json.results ?? {}).length;
      const failures = Number(json.failures ?? 0);
      setToast(
        failures
          ? `⚠ ${total} plateforme(s) traitée(s), dont ${failures} avec une limitation ou une erreur.`
          : `✓ ${total} plateforme(s) collectée(s) avec succès.`,
      );
      router.refresh();
    } catch {
      setToast("❌ Erreur réseau.");
    } finally {
      setLoadingField(null);
    }
  }

  async function applyImage(imageUrl: string, target: "image_url" | "banner_url") {
    setApplying(true);
    try {
      const res = await fetch(`/api/admin/artistes/${artistId}/enrich`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, target }),
      });
      const json = await res.json();
      setToast(res.ok ? `✓ ${json.message}` : `❌ ${json.error}`);
      if (res.ok) router.refresh();
    } catch {
      setToast("❌ Erreur réseau.");
    } finally {
      setApplying(false);
    }
  }

  // Toutes les images collectées depuis toutes les plateformes
  const allImages = Array.from(
    new Map(
      Object.values(results)
        .flatMap((result) => result.images ?? [])
        .map((image) => [image.url, image]),
    ).values(),
  );

  return (
    <div>
      <MetricsSection summaries={metricSummaries} />

      <p style={{ fontSize: "0.82rem", color: "var(--admin-muted)", margin: "0 0 0.8rem" }}>
        Cliquez sur un bouton pour collecter les données de cette plateforme uniquement,
        depuis l&apos;URL renseignée ci-dessus. Aucune recherche aléatoire : seules les
        URLs que vous avez saisies sont utilisées.
      </p>

      {/* Boutons de collecte par plateforme */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={collectAllFields}
          disabled={loadingField !== null || loadingHistory || availableFields.length === 0}
        >
          {loadingField === "all" ? "Collecte en cours…" : `Collecter toutes les URLs (${availableFields.length})`}
        </button>
        {Object.entries(FIELD_LABELS).map(([field, { label, icon }]) => (
          <button
            key={field}
            type="button"
            className="btn btn--sm"
            style={{
              background: results[field] && !results[field].error && hasUsableResult(results[field])
                ? "var(--admin-ok)"
                : undefined,
              color: results[field] && !results[field].error && hasUsableResult(results[field])
                ? "#04210f"
                : undefined,
            }}
            onClick={() => collectField(field)}
            disabled={loadingField !== null || loadingHistory || !availableFields.includes(field)}
            title={availableFields.includes(field) ? `Collecter ${label}` : `Enregistrez d'abord l'URL ${label}`}
          >
            {loadingField === field ? "⟳…" : `${icon} Collecter ${label}`}
          </button>
        ))}
      </div>

      {loadingHistory ? (
        <p style={{ fontSize: "0.76rem", color: "var(--admin-muted)" }}>Chargement des collectes précédentes…</p>
      ) : null}

      {toast && <p style={{ fontSize: "0.82rem", color: toast.startsWith("✓") ? "var(--admin-ok)" : "var(--admin-danger)", margin: "0 0 0.8rem" }}>{toast}</p>}

      {/* Résultats de collecte */}
      {Object.entries(results).map(([field, data]) => (
        <div
          key={field}
          style={{
            border: `1px solid ${data.error ? "var(--admin-warn)" : "var(--admin-border)"}`,
            borderRadius: 10,
            padding: "0.7rem",
            marginBottom: "0.6rem",
            background: "var(--admin-panel-2)",
          }}
        >
          <strong style={{ fontSize: "0.85rem" }}>
            {FIELD_LABELS[field]?.icon} {FIELD_LABELS[field]?.label ?? field}
            {data.name && <span style={{ fontWeight: 400, color: "var(--admin-muted)", marginLeft: "0.4rem" }}>— {data.name}</span>}
          </strong>

          {data.error && <p style={{ fontSize: "0.75rem", color: "var(--admin-warn)", margin: "0.3rem 0 0" }}>⚠ {data.error}</p>}
          {!data.error && !hasUsableResult(data) ? (
            <p style={{ fontSize: "0.75rem", color: "var(--admin-warn)", margin: "0.3rem 0 0" }}>
              ⚠ Aucune donnée exploitable n&apos;a été reçue.
            </p>
          ) : null}
          {data.description ? (
            <p style={{ fontSize: "0.75rem", color: "var(--admin-muted)", margin: "0.35rem 0" }}>
              {data.description.length > 320 ? `${data.description.slice(0, 320)}…` : data.description}
            </p>
          ) : null}
          {(data.warnings ?? []).map((warning) => (
            <p key={warning} style={{ fontSize: "0.72rem", color: "var(--admin-warn)", margin: "0.2rem 0" }}>
              ⚠ {warning}
            </p>
          ))}

          <div style={{ fontSize: "0.78rem", color: "var(--admin-text)", lineHeight: 1.8, marginTop: "0.3rem" }}>
            {data.monthlyListeners !== null && <div>🎧 Auditeurs mensuels : <strong>{formatBigNumber(data.monthlyListeners)}</strong></div>}
            {data.followers !== null && <div>👥 Followers / Fans : <strong>{formatBigNumber(data.followers)}</strong></div>}
            {data.subscriberCount !== null && <div>📺 Abonnés : <strong>{formatBigNumber(data.subscriberCount)}</strong></div>}
            {data.totalViews !== null && <div>👁 Vues totales : <strong>{formatBigNumber(data.totalViews)}</strong></div>}
            {data.albumCount !== null && <div>💿 Albums : <strong>{data.albumCount}</strong></div>}
            {data.trackCount !== null && <div>🎵 Titres / Vidéos : <strong>{data.trackCount}</strong></div>}
            {data.popularity !== null && <div>Popularité : <strong>{data.popularity}/100</strong></div>}
            {data.genres.length > 0 && <div>🏷️ Genres : {data.genres.join(", ")}</div>}
            {Object.entries(data.details ?? {}).map(([key, value]) => (
              value === null || value === "" || (Array.isArray(value) && value.length === 0) ? null : (
                <div key={key}>
                  {key.replaceAll("_", " ")} : <strong>{Array.isArray(value) ? value.join(", ") : String(value)}</strong>
                </div>
              )
            ))}
          </div>

          <p style={{ fontSize: "0.68rem", color: "var(--admin-muted)", margin: "0.2rem 0 0" }}>
            Source : {formatCollectionMethod(data.method)}
            {data.fetchedAt ? ` · ${new Date(data.fetchedAt).toLocaleString("fr")}` : ""}
          </p>
        </div>
      ))}

      {/* Sélection d'images collectées */}
      {allImages.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.85rem" }}>📷 Images collectées — cliquez pour appliquer</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.6rem" }}>
            {allImages.map((img, i) => (
              <div key={`${img.url}-${i}`} style={{ textAlign: "center", width: img.type === "banner" ? 200 : 120 }}>
                <img
                  src={img.url}
                  alt={img.label}
                  style={{
                    width: img.type === "banner" ? 200 : 120,
                    height: img.type === "banner" ? 70 : 120,
                    objectFit: "cover",
                    borderRadius: img.type === "banner" ? 8 : "50%",
                    border: "2px solid var(--admin-border)",
                    cursor: "pointer",
                  }}
                  title={img.label}
                />
                <div style={{ display: "flex", gap: "0.2rem", justifyContent: "center", marginTop: "0.3rem" }}>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={applying}
                    onClick={() => applyImage(img.url, "image_url")}
                    title="Utiliser comme photo de profil"
                    style={{ fontSize: "0.68rem", padding: "0.15rem 0.35rem" }}
                  >
                    📷 Profil
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={applying}
                    onClick={() => applyImage(img.url, "banner_url")}
                    title="Utiliser comme bannière"
                    style={{ fontSize: "0.68rem", padding: "0.15rem 0.35rem" }}
                  >
                    🖼️ Bannière
                  </button>
                </div>
                <p style={{ fontSize: "0.65rem", color: "var(--admin-muted)", margin: "0.15rem 0 0" }}>{img.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
