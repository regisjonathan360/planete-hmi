#!/usr/bin/env node
/**
 * Collecte Deezer Haiti — depuis une playlist communautaire.
 * L'API Deezer est publique, gratuite, sans clé, et supporte CORS.
 *
 * Playlist par défaut : "Trap Kreyol & Rap Kreyol Haiti Top 100"
 * (ID 15034575123 — 105 tracks d'artistes haïtiens)
 *
 * Usage :
 *   node scripts/collect-deezer.mjs
 *
 * Env :
 *   CRON_SECRET      — secret pour envoyer à l'API prod
 *   PROD_URL         — défaut https://planete-hmi.vercel.app
 *   DEEZER_PLAYLIST  — ID de la playlist (défaut: 15034575123)
 */

const PROD_URL = process.env.PROD_URL || "https://planete-hmi.vercel.app";
const PLAYLIST_ID = process.env.DEEZER_PLAYLIST || "15034575123";
const API_URL = `https://api.deezer.com/playlist/${PLAYLIST_ID}/tracks?limit=100`;

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

console.log(`⟳ Collecte Deezer (playlist ${PLAYLIST_ID})...`);

const res = await fetch(API_URL);
if (!res.ok) {
  console.error(`❌ Deezer API a répondu HTTP ${res.status}`);
  process.exit(1);
}

const data = await res.json();
const tracks = data.data ?? [];

if (!tracks.length) {
  console.error("❌ Aucun track dans la playlist.");
  process.exit(1);
}

console.log(`✓ ${tracks.length} tracks récupérés`);
console.log(`   #1: ${tracks[0].artist.name} - ${tracks[0].title}`);
console.log(`   #2: ${tracks[1]?.artist.name} - ${tracks[1]?.title}`);
console.log(`   #3: ${tracks[2]?.artist.name} - ${tracks[2]?.title}`);

const entries = tracks.slice(0, 100).map((track, index) => ({
  platform: "deezer",
  countryCode: "HT",
  rank: index + 1,
  platformTrackId: String(track.id),
  title: track.title,
  artistName: track.artist.name,
  artworkUrl: track.album?.cover_medium ?? null,
  artistImageUrl: track.artist.picture_medium ?? null,
  sourceTrackUrl: track.link ?? null,
  artistSlug: slugify(track.artist.name),
  trackSlug: slugify(track.title),
  albumName: track.album?.title ?? null,
  genre: null,
}));

const SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
if (!SECRET) {
  const fs = await import("fs");
  fs.writeFileSync("scripts/deezer-entries.json", JSON.stringify({ entries }, null, 2));
  console.log(`\n✅ ${entries.length} entrées sauvegardées dans scripts/deezer-entries.json`);
  console.log("   Pour envoyer à prod : set CRON_SECRET=... && node scripts/collect-deezer.mjs");
  process.exit(0);
}

console.log(`\n⟳ Envoi de ${entries.length} entrées à ${PROD_URL}…`);
const sendRes = await fetch(`${PROD_URL}/api/admin/charts/collect-local`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  body: JSON.stringify({ entries, sourceUpdatedAt: new Date().toISOString(), sourceKey: "deezer_haiti_top100" }),
});
const json = await sendRes.json();
console.log(`\n${sendRes.ok && json.status !== "error" ? "✅" : "❌"}`, JSON.stringify(json, null, 2));
