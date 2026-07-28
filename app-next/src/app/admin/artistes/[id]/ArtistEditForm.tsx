"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  "chanteur", "chanteuse", "rappeur", "rappeuse", "beatmaker",
  "producteur", "productrice", "compositeur", "compositrice",
  "auteur", "autrice", "dj", "musicien", "musicienne",
  "groupe", "orchestre", "arrangeur", "ingenieur_son",
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
    const tags = form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag];
    update("tags", tags);
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
            <select value={form.artist_type} onChange={(e) => update("artist_type", e.target.value)} style={inputStyle}>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleTag(role)}
              className="btn btn--sm"
              style={{
                background: form.tags.includes(role) ? "var(--admin-accent)" : "transparent",
                borderColor: form.tags.includes(role) ? "var(--admin-accent)" : "var(--admin-border)",
                color: form.tags.includes(role) ? "#fff" : "var(--admin-muted)",
              }}
            >
              {role}
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
        <EnrichmentPanel artistId={artist.id as string} />
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

// ---------- Panneau d'enrichissement automatique ----------

interface PlatformData {
  platform: string;
  name: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  monthlyListeners: number | null;
  followers: number | null;
  subscriberCount: number | null;
  totalViews: number | null;
  genres: string[];
  albumCount: number | null;
  trackCount: number | null;
  method: string;
  error: string | null;
}

function formatBigNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  youtube: "YouTube",
  audiomack: "Audiomack",
};

function EnrichmentPanel({ artistId }: { artistId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    platforms: PlatformData[];
    applied: { imageUrl: boolean; bannerUrl: boolean; primaryGenre: boolean };
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEnrich() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/artistes/${artistId}/enrich`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur."); return; }
      setResult({ platforms: json.platforms, applied: json.applied, warnings: json.warnings });
      router.refresh();
    } catch { setError("Erreur réseau."); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <p style={{ fontSize: "0.82rem", color: "var(--admin-muted)", margin: "0 0 0.8rem" }}>
        Récupère automatiquement les données publiques depuis Spotify, Deezer, YouTube et Audiomack :
        photo, bannière, auditeurs mensuels, abonnés, vues totales, genres, nombre d&apos;albums/titres.
        Les champs vides de la fiche sont complétés. Les métriques sont sauvegardées dans les identités plateforme.
      </p>

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleEnrich}
        disabled={loading}
      >
        {loading ? "⟳ Enrichissement en cours…" : "🔄 Récupérer les données de toutes les plateformes"}
      </button>

      {error && <p style={{ color: "var(--admin-danger)", fontSize: "0.82rem", marginTop: "0.6rem" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "1rem" }}>
          {/* Résumé des actions */}
          {(result.applied.imageUrl || result.applied.bannerUrl || result.applied.primaryGenre) && (
            <p style={{ fontSize: "0.82rem", color: "var(--admin-ok)", margin: "0 0 0.6rem" }}>
              ✓ Mis à jour :
              {result.applied.imageUrl && " photo de profil"}
              {result.applied.bannerUrl && " · bannière"}
              {result.applied.primaryGenre && " · genre principal"}
            </p>
          )}

          {result.warnings.length > 0 && (
            <details style={{ marginBottom: "0.8rem" }}>
              <summary style={{ fontSize: "0.78rem", color: "var(--admin-warn)", cursor: "pointer" }}>
                ⚠ {result.warnings.length} avertissement(s)
              </summary>
              <ul style={{ fontSize: "0.75rem", color: "var(--admin-muted)", paddingLeft: "1.2rem", margin: "0.3rem 0" }}>
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}

          {/* Tableau des résultats par plateforme */}
          <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {result.platforms.map((pm) => (
              <div
                key={pm.platform}
                style={{
                  border: `1px solid ${pm.error ? "var(--admin-warn)" : "var(--admin-border)"}`,
                  borderRadius: 10,
                  padding: "0.7rem",
                  background: "var(--admin-panel-2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  {pm.imageUrl && (
                    <img src={pm.imageUrl} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <div>
                    <strong style={{ fontSize: "0.85rem" }}>{PLATFORM_LABELS[pm.platform] ?? pm.platform}</strong>
                    {pm.name && <span style={{ fontSize: "0.75rem", color: "var(--admin-muted)", marginLeft: "0.4rem" }}>{pm.name}</span>}
                  </div>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--admin-text)", lineHeight: 1.7 }}>
                  {pm.monthlyListeners !== null && <div>🎧 Auditeurs mensuels : <strong>{formatBigNumber(pm.monthlyListeners)}</strong></div>}
                  {pm.followers !== null && <div>👥 Followers / Fans : <strong>{formatBigNumber(pm.followers)}</strong></div>}
                  {pm.subscriberCount !== null && <div>📺 Abonnés : <strong>{formatBigNumber(pm.subscriberCount)}</strong></div>}
                  {pm.totalViews !== null && <div>👁 Vues totales : <strong>{formatBigNumber(pm.totalViews)}</strong></div>}
                  {pm.albumCount !== null && <div>💿 Albums : <strong>{pm.albumCount}</strong></div>}
                  {pm.trackCount !== null && <div>🎵 Titres / Vidéos : <strong>{pm.trackCount}</strong></div>}
                  {pm.genres.length > 0 && <div>🏷️ Genres : {pm.genres.join(", ")}</div>}
                  {pm.bannerUrl && <div>🖼️ <a href={pm.bannerUrl} target="_blank" rel="noreferrer" style={{ color: "var(--admin-accent-2)" }}>Voir la bannière</a></div>}
                </div>

                {pm.error && <p style={{ fontSize: "0.72rem", color: "var(--admin-warn)", margin: "0.3rem 0 0" }}>⚠ {pm.error}</p>}
                <p style={{ fontSize: "0.68rem", color: "var(--admin-muted)", margin: "0.2rem 0 0" }}>via {pm.method}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
