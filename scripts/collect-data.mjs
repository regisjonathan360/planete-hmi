// =========================================================
// Planète HMI — Collecteur de données automatique
//
// Rôle : interroge les APIs des plateformes de musique pour une
// liste d'artistes haïtiens, agrège les métriques réelles
// disponibles et écrit des fichiers JSON consommés par le site
// statique.
//
// Exécuté par GitHub Actions (voir .github/workflows/collect.yml)
// mais aussi lançable en local :  node scripts/collect-data.mjs
//
// Sources :
//   - Deezer   : public, SANS clé  (nombre de fans, top titre, photo)
//   - Spotify  : optionnel, via SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
//                (followers + popularité 0-100)
//   - YouTube  : optionnel, via YOUTUBE_API_KEY
//                (abonnés + vues cumulées de la chaîne)
//
// Aucune dépendance npm : Node 18+ (fetch natif).
// =========================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const SEED_PATH = join(DATA_DIR, "artists.seed.json");

const SPOTIFY_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY || "";

// ---------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalise un nom : minuscules, sans accents, espaces réduits.
function normaliser(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error("HTTP " + res.status + " sur " + url);
  }
  return res.json();
}

// Normalisation logarithmique d'une métrique brute → 0..100
// (les audiences varient sur plusieurs ordres de grandeur).
function scoreLog(valeur, plancher, plafond) {
  if (!valeur || valeur <= 0) return 0;
  const v = Math.log10(valeur);
  const min = Math.log10(plancher);
  const max = Math.log10(plafond);
  const t = (v - min) / (max - min);
  return Math.max(0, Math.min(100, Math.round(t * 1000) / 10));
}

// ---------------------------------------------------------
// Deezer (public, sans clé)
// ---------------------------------------------------------
async function collecteDeezer(nom) {
  try {
    const q = encodeURIComponent(nom);
    const rech = await getJSON("https://api.deezer.com/search/artist?limit=5&q=" + q);
    const cible = normaliser(nom);
    const artiste = (rech.data || []).find((a) => normaliser(a.name) === cible)
      || (rech.data || [])[0];
    if (!artiste) return null;

    // Top titre de l'artiste (pour un extrait/preview cohérent).
    let topTitre = null;
    try {
      const top = await getJSON("https://api.deezer.com/artist/" + artiste.id + "/top?limit=1");
      if (top.data && top.data[0]) topTitre = top.data[0].title;
    } catch { /* non bloquant */ }

    return {
      id: artiste.id,
      nom: artiste.name,
      fans: artiste.nb_fan || 0,
      photo: artiste.picture_medium || artiste.picture || null,
      lien: artiste.link || null,
      topTitre
    };
  } catch (e) {
    console.warn("  Deezer échec pour", nom, "->", e.message);
    return null;
  }
}

// ---------------------------------------------------------
// Spotify (optionnel — client credentials)
// ---------------------------------------------------------
let spotifyToken = null;
async function tokenSpotify() {
  if (!SPOTIFY_ID || !SPOTIFY_SECRET) return null;
  if (spotifyToken) return spotifyToken;
  try {
    const creds = Buffer.from(SPOTIFY_ID + ":" + SPOTIFY_SECRET).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + creds,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    spotifyToken = j.access_token;
    return spotifyToken;
  } catch (e) {
    console.warn("  Spotify token échec ->", e.message);
    return null;
  }
}

async function collecteSpotify(nom) {
  const token = await tokenSpotify();
  if (!token) return null;
  try {
    const q = encodeURIComponent(nom);
    const rech = await getJSON(
      "https://api.spotify.com/v1/search?type=artist&limit=5&q=" + q,
      { headers: { "Authorization": "Bearer " + token } }
    );
    const items = (rech.artists && rech.artists.items) || [];
    const cible = normaliser(nom);
    const artiste = items.find((a) => normaliser(a.name) === cible) || items[0];
    if (!artiste) return null;
    return {
      id: artiste.id,
      nom: artiste.name,
      followers: (artiste.followers && artiste.followers.total) || 0,
      popularite: artiste.popularity || 0,
      photo: (artiste.images && artiste.images[0] && artiste.images[0].url) || null,
      lien: (artiste.external_urls && artiste.external_urls.spotify) || null
    };
  } catch (e) {
    console.warn("  Spotify échec pour", nom, "->", e.message);
    return null;
  }
}

// ---------------------------------------------------------
// YouTube (optionnel — clé API)
// ---------------------------------------------------------
async function collecteYouTube(nom) {
  if (!YOUTUBE_KEY) return null;
  try {
    const q = encodeURIComponent(nom);
    const rech = await getJSON(
      "https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=" +
        q + "&key=" + YOUTUBE_KEY
    );
    const item = (rech.items || [])[0];
    if (!item) return null;
    const channelId = item.id.channelId;
    const stats = await getJSON(
      "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=" +
        channelId + "&key=" + YOUTUBE_KEY
    );
    const ch = (stats.items || [])[0];
    if (!ch) return null;
    return {
      id: channelId,
      nom: ch.snippet.title,
      abonnes: Number(ch.statistics.subscriberCount || 0),
      vues: Number(ch.statistics.viewCount || 0),
      photo: (ch.snippet.thumbnails && ch.snippet.thumbnails.medium &&
              ch.snippet.thumbnails.medium.url) || null,
      lien: "https://www.youtube.com/channel/" + channelId
    };
  } catch (e) {
    console.warn("  YouTube échec pour", nom, "->", e.message);
    return null;
  }
}

// ---------------------------------------------------------
// Score HMI agrégé
// Moyenne pondérée des métriques DISPONIBLES uniquement.
// ---------------------------------------------------------
function calculerScoreHMI(d) {
  const parts = [];
  if (d.deezer) {
    parts.push({ v: scoreLog(d.deezer.fans, 1e3, 5e6), w: 1 });
  }
  if (d.spotify) {
    parts.push({ v: scoreLog(d.spotify.followers, 1e3, 5e6), w: 1 });
    parts.push({ v: d.spotify.popularite, w: 1.2 });
  }
  if (d.youtube) {
    parts.push({ v: scoreLog(d.youtube.abonnes, 1e3, 5e6), w: 1 });
    parts.push({ v: scoreLog(d.youtube.vues, 1e5, 1e9), w: 1 });
  }
  if (!parts.length) return 0;
  const somme = parts.reduce((s, p) => s + p.v * p.w, 0);
  const poids = parts.reduce((s, p) => s + p.w, 0);
  return Math.round((somme / poids) * 10) / 10;
}

// ---------------------------------------------------------
// Programme principal
// ---------------------------------------------------------
async function main() {
  const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
  const liste = seed.artistes || [];

  console.log("Collecte pour " + liste.length + " artistes…");
  console.log("Sources actives : Deezer" +
    (SPOTIFY_ID && SPOTIFY_SECRET ? " + Spotify" : "") +
    (YOUTUBE_KEY ? " + YouTube" : ""));

  const artistes = [];

  for (const a of liste) {
    process.stdout.write("• " + a.nom + " … ");
    const [deezer, spotify, youtube] = await Promise.all([
      collecteDeezer(a.nom),
      collecteSpotify(a.nom),
      collecteYouTube(a.nom)
    ]);

    const entree = {
      nom: a.nom,
      genre: a.genre,
      photo: (spotify && spotify.photo) || (youtube && youtube.photo) ||
             (deezer && deezer.photo) || null,
      topTitre: (deezer && deezer.topTitre) || null,
      metriques: {
        deezerFans: deezer ? deezer.fans : null,
        spotifyFollowers: spotify ? spotify.followers : null,
        spotifyPopularite: spotify ? spotify.popularite : null,
        youtubeAbonnes: youtube ? youtube.abonnes : null,
        youtubeVues: youtube ? youtube.vues : null
      },
      liens: {
        deezer: deezer ? deezer.lien : null,
        spotify: spotify ? spotify.lien : null,
        youtube: youtube ? youtube.lien : null
      },
      deezer, spotify, youtube
    };
    entree.scoreHMI = calculerScoreHMI(entree);
    // On n'expose pas les sous-objets bruts dans le fichier final.
    delete entree.deezer; delete entree.spotify; delete entree.youtube;

    artistes.push(entree);
    console.log("HMI " + entree.scoreHMI);
    await sleep(250); // courtoisie envers les APIs
  }

  // Classement décroissant par score HMI.
  const classement = [...artistes]
    .filter((a) => a.scoreHMI > 0)
    .sort((a, b) => b.scoreHMI - a.scoreHMI)
    .map((a, i) => ({
      rang: i + 1,
      nom: a.nom,
      genre: a.genre,
      titre: a.topTitre,
      score: a.scoreHMI,
      photo: a.photo
    }));

  const meta = {
    genereLe: new Date().toISOString(),
    nbArtistes: artistes.length,
    sources: ["Deezer"].concat(
      SPOTIFY_ID && SPOTIFY_SECRET ? ["Spotify"] : [],
      YOUTUBE_KEY ? ["YouTube"] : []
    ),
    note: "Le score HMI est un indice agrégé calculé à partir des métriques publiques réellement disponibles sur les plateformes. Ce n'est pas un décompte officiel des ventes ou des vues."
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, "artists.json"),
    JSON.stringify({ meta, artistes }, null, 2), "utf8");
  await writeFile(join(DATA_DIR, "rankings.json"),
    JSON.stringify({ meta, classement }, null, 2), "utf8");
  await writeFile(join(DATA_DIR, "meta.json"),
    JSON.stringify(meta, null, 2), "utf8");

  console.log("\nÉcrit : data/artists.json, data/rankings.json, data/meta.json");
  console.log("Généré le " + meta.genereLe);
}

main().catch((e) => {
  console.error("Échec de la collecte :", e);
  process.exit(1);
});
