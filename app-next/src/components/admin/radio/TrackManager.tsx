"use client";

import { useState } from "react";
import type { RadioTrack } from "@/lib/radio/types";
import styles from "./TrackManager.module.css";

interface Props { tracks: RadioTrack[]; onTracksUpdate: (tracks: RadioTrack[]) => void; }

export function TrackManager({ tracks, onTracksUpdate }: Props) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"url" | "file">("url");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = tracks.filter((track) => `${track.title} ${track.artist_name}`.toLowerCase().includes(search.toLowerCase()));

  async function addTrack() {
    setBusy(true); setMessage("");
    try {
      let response: Response;
      if (mode === "file") {
        if (!file) throw new Error("Choisissez un fichier audio");
        const form = new FormData(); form.set("file", file); form.set("title", title); form.set("artist_name", artist);
        response = await fetch("/api/admin/radio/tracks/upload", { method: "POST", body: form });
      } else {
        response = await fetch("/api/admin/radio/tracks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, artist_name: artist, audio_url: url }) });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ajout impossible");
      onTracksUpdate([data, ...tracks]); setTitle(""); setArtist(""); setUrl(""); setFile(null); setShowForm(false); setMessage("Piste ajoutée");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ajout impossible"); }
    finally { setBusy(false); }
  }

  return <section className={styles.manager}>
    <div className={styles.header}><div><h2>Bibliothèque audio</h2><p>Fichiers hébergés ou URLs directes MP3, WAV, OGG et M4A.</p></div><button className={styles.addButton} onClick={() => setShowForm(true)}>+ Ajouter une piste</button></div>
    <input className={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un titre ou un artiste" />
    {showForm && <div className={styles.modal}><div className={styles.modalContent}>
      <h3>Ajouter une piste</h3><div className={styles.filters}><button onClick={() => setMode("url")} className={mode === "url" ? styles.addButton : styles.actionButton}>Lien audio</button><button onClick={() => setMode("file")} className={mode === "file" ? styles.addButton : styles.actionButton}>Fichier local</button></div>
      <input className={styles.searchInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" />
      <input className={styles.searchInput} value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artiste" />
      {mode === "url" ? <input className={styles.searchInput} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://exemple.com/audio.mp3" type="url" /> : <input className={styles.searchInput} onChange={(event) => setFile(event.target.files?.[0] || null)} type="file" accept="audio/*" />}
      {message && <p>{message}</p>}<div className={styles.formActions}><button onClick={() => setShowForm(false)} className={styles.closeButton}>Annuler</button><button onClick={() => void addTrack()} disabled={busy} className={styles.addButton}>{busy ? "Envoi…" : "Ajouter"}</button></div>
    </div></div>}
    <div className={styles.trackList}>{filtered.map((track) => <div key={track.id} className={styles.trackCard}><div className={styles.trackInfo}><strong>{track.title}</strong><span>{track.artist_name}</span><small>{track.source} · {track.play_count} écoutes</small></div><button className={styles.actionButton} onClick={() => new Audio(track.audio_url).play()}>Écouter</button><button className={styles.actionButton} onClick={async () => { if (!window.confirm(`Supprimer « ${track.title} » ?`)) return; const response = await fetch(`/api/admin/radio/tracks/${track.id}`, { method: "DELETE" }); if (response.ok) onTracksUpdate(tracks.filter((item) => item.id !== track.id)); }}>Supprimer</button></div>)}</div>
  </section>;
}
