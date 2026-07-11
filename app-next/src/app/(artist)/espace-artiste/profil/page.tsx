"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Page de personnalisation du profil artiste.
 * L'artiste peut modifier : bio, ville, label, genre, date de naissance,
 * plateformes musicales, réseaux sociaux.
 */

interface ProfileFormData {
  bio: string;
  city: string;
  label: string;
  primary_genre: string;
  real_name: string;
  career_start_year: string;
  birth_date: string;
  url_spotify: string;
  url_apple_music: string;
  url_youtube_music: string;
  url_audiomack: string;
  url_deezer: string;
  url_soundcloud: string;
  url_tidal: string;
  url_instagram: string;
  url_tiktok: string;
  url_twitter: string;
  url_facebook: string;
  url_youtube: string;
  url_threads: string;
  url_website: string;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormData>({
    bio: "",
    city: "",
    label: "",
    primary_genre: "",
    real_name: "",
    career_start_year: "",
    birth_date: "",
    url_spotify: "",
    url_apple_music: "",
    url_youtube_music: "",
    url_audiomack: "",
    url_deezer: "",
    url_soundcloud: "",
    url_tidal: "",
    url_instagram: "",
    url_tiktok: "",
    url_twitter: "",
    url_facebook: "",
    url_youtube: "",
    url_threads: "",
    url_website: "",
  });

  function update(field: keyof ProfileFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/artist/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Erreur lors de la sauvegarde.");
      } else {
        setMessage("Profil mis à jour !");
        router.refresh();
      }
    } catch {
      setMessage("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Personnaliser mon profil
      </h1>
      <p style={{ color: "rgba(244,239,228,0.6)", marginBottom: "2rem", fontSize: "0.88rem" }}>
        Ces informations apparaîtront sur votre page artiste publique (sauf date de naissance et nom réel).
      </p>

      <form onSubmit={handleSubmit}>
        <Section title="Informations générales">
          <Field label="Biographie" hint="Courte description visible sur votre profil">
            <textarea rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} />
          </Field>
          <Field label="Ville / Localisation">
            <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Port-au-Prince, Miami…" />
          </Field>
          <Field label="Genre principal">
            <select value={form.primary_genre} onChange={(e) => update("primary_genre", e.target.value)}>
              <option value="">— Choisir —</option>
              <option value="konpa">Konpa</option>
              <option value="raboday">Raboday</option>
              <option value="hip-hop-rap">Hip-Hop / Rap</option>
              <option value="dancehall">Dancehall</option>
              <option value="afrosounds">Afrosounds</option>
              <option value="r-b">R&B</option>
              <option value="pop">Pop</option>
              <option value="gospel">Gospel</option>
              <option value="jazz-blues">Jazz / Blues</option>
              <option value="electronic">Electronic</option>
              <option value="rock">Rock</option>
              <option value="latin">Latin</option>
              <option value="caribbean">Caribbean</option>
            </select>
          </Field>
          <Field label="Label / Collectif">
            <input type="text" value={form.label} onChange={(e) => update("label", e.target.value)} />
          </Field>
          <Field label="Année de début de carrière">
            <input type="number" min="1950" max="2026" value={form.career_start_year} onChange={(e) => update("career_start_year", e.target.value)} />
          </Field>
        </Section>

        <Section title="Informations privées (non affichées publiquement)">
          <Field label="Nom réel" hint="Visible uniquement par vous et les administrateurs">
            <input type="text" value={form.real_name} onChange={(e) => update("real_name", e.target.value)} />
          </Field>
          <Field label="Date de naissance" hint="Utilisée pour la section Anniversaires (jour et mois affichés)">
            <input type="date" value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} />
          </Field>
        </Section>

        <Section title="Plateformes musicales">
          <Field label="Spotify"><input type="url" value={form.url_spotify} onChange={(e) => update("url_spotify", e.target.value)} placeholder="https://open.spotify.com/artist/..." /></Field>
          <Field label="Apple Music"><input type="url" value={form.url_apple_music} onChange={(e) => update("url_apple_music", e.target.value)} placeholder="https://music.apple.com/artist/..." /></Field>
          <Field label="YouTube Music"><input type="url" value={form.url_youtube_music} onChange={(e) => update("url_youtube_music", e.target.value)} placeholder="https://music.youtube.com/channel/..." /></Field>
          <Field label="Audiomack"><input type="url" value={form.url_audiomack} onChange={(e) => update("url_audiomack", e.target.value)} placeholder="https://audiomack.com/..." /></Field>
          <Field label="Deezer"><input type="url" value={form.url_deezer} onChange={(e) => update("url_deezer", e.target.value)} placeholder="https://www.deezer.com/artist/..." /></Field>
          <Field label="SoundCloud"><input type="url" value={form.url_soundcloud} onChange={(e) => update("url_soundcloud", e.target.value)} placeholder="https://soundcloud.com/..." /></Field>
          <Field label="Tidal"><input type="url" value={form.url_tidal} onChange={(e) => update("url_tidal", e.target.value)} placeholder="https://tidal.com/artist/..." /></Field>
        </Section>

        <Section title="Réseaux sociaux">
          <Field label="Instagram"><input type="url" value={form.url_instagram} onChange={(e) => update("url_instagram", e.target.value)} placeholder="https://instagram.com/..." /></Field>
          <Field label="TikTok"><input type="url" value={form.url_tiktok} onChange={(e) => update("url_tiktok", e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
          <Field label="X / Twitter"><input type="url" value={form.url_twitter} onChange={(e) => update("url_twitter", e.target.value)} placeholder="https://x.com/..." /></Field>
          <Field label="Facebook"><input type="url" value={form.url_facebook} onChange={(e) => update("url_facebook", e.target.value)} placeholder="https://facebook.com/..." /></Field>
          <Field label="YouTube"><input type="url" value={form.url_youtube} onChange={(e) => update("url_youtube", e.target.value)} placeholder="https://youtube.com/@..." /></Field>
          <Field label="Threads"><input type="url" value={form.url_threads} onChange={(e) => update("url_threads", e.target.value)} placeholder="https://threads.net/@..." /></Field>
          <Field label="Site web"><input type="url" value={form.url_website} onChange={(e) => update("url_website", e.target.value)} placeholder="https://..." /></Field>
        </Section>

        {message && (
          <p style={{ marginTop: "1rem", color: message.includes("Erreur") ? "#ff5c7c" : "#3ddc84", fontSize: "0.88rem" }}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: "1.5rem",
            padding: "0.7rem 1.5rem",
            background: "#7c5cff",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid rgba(244,239,228,0.1)", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem" }}>
      <legend style={{ fontWeight: 700, fontSize: "0.9rem", padding: "0 0.5rem", color: "rgba(244,239,228,0.85)" }}>{title}</legend>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "rgba(244,239,228,0.7)" }}>{label}</span>
      {hint && <span style={{ fontSize: "0.72rem", color: "rgba(244,239,228,0.45)" }}>{hint}</span>}
      {children}
      <style>{`
        .artist-profile-form input, .artist-profile-form textarea, .artist-profile-form select {
          background: rgba(10,10,20,0.8); border: 1px solid rgba(244,239,228,0.12);
          color: #f4efe4; padding: 0.55rem 0.7rem; border-radius: 8px; font-size: 0.88rem;
          font-family: inherit; width: 100%;
        }
        .artist-profile-form input:focus, .artist-profile-form textarea:focus, .artist-profile-form select:focus {
          outline: none; border-color: #7c5cff;
        }
      `}</style>
    </label>
  );
}
