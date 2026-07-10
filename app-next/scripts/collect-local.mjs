#!/usr/bin/env node
/**
 * Collecte Audiomack depuis ta machine locale (IP résidentielle).
 * Audiomack bloque les IPs datacenter (Vercel), ce script contourne le problème.
 *
 * Usage :
 *   node scripts/collect-local.mjs
 *
 * Le script :
 * 1. Scrape la page Audiomack Haiti depuis ton PC
 * 2. Parse les entrées
 * 3. Envoie les données à ton API prod /api/admin/charts/collect
 *
 * Prérequis : être connecté à l'admin dans ton navigateur (cookies de session).
 * Alternative : tu peux copier ton cookie de session et le passer en env.
 */

const PROD_URL = process.env.PROD_URL || "https://planete-hmi.vercel.app";
const AUDIOMACK_URL = "https://audiomack.com/geo-charts/playlist/haiti";

// --- Étape 1 : Scraper la page Audiomack ---
console.log("⟳ Scraping Audiomack Haiti...");

const response = await fetch(AUDIOMACK_URL, {
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
});

if (!response.ok) {
  console.error(`❌ Audiomack a répondu HTTP ${response.status}`);
  process.exit(1);
}

const html = await response.text();
console.log(`✓ Page reçue (${(html.length / 1024).toFixed(0)} KB)`);

// --- Étape 2 : Parser les tracks ---
const PUSH_PREFIX = "self.__next_f.push(";

function findClosingParen(text, start) {
  let depth = 1, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === "(") depth++;
    else if (char === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function collectStrings(value, out = []) {
  if (typeof value === "string") { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach(item => collectStrings(item, out)); return out; }
  if (value && typeof value === "object") Object.values(value).forEach(item => collectStrings(item, out));
  return out;
}

function extractFlightText(html) {
  const chunks = [];
  let searchFrom = 0;
  while (searchFrom < html.length) {
    const callStart = html.indexOf(PUSH_PREFIX, searchFrom);
    if (callStart === -1) break;
    const argsStart = callStart + PUSH_PREFIX.length;
    const argsEnd = findClosingParen(html, argsStart);
    if (argsEnd === -1) break;
    try { collectStrings(JSON.parse(html.slice(argsStart, argsEnd)), chunks); } catch {}
    searchFrom = argsEnd + 1;
  }
  return chunks.join("");
}

function readBalancedJson(text, start) {
  const opener = text[start];
  if (opener !== "[" && opener !== "{") return null;
  const stack = [];
  let inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === "[" || char === "{") stack.push(char === "[" ? "]" : "}");
    else if (char === "]" || char === "}") { if (stack.pop() !== char) return null; if (stack.length === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function extractTrackArrays(text) {
  const arrays = [];
  const key = '"tracks":';
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const keyIndex = text.indexOf(key, searchFrom);
    if (keyIndex === -1) break;
    const valueStart = keyIndex + key.length;
    const json = readBalancedJson(text, valueStart);
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title && parsed[0].artist) {
          arrays.push(parsed);
        }
      } catch {}
    }
    searchFrom = valueStart + 1;
  }
  return arrays;
}

const flightText = extractFlightText(html);
const candidates = extractTrackArrays(flightText).sort((a, b) => b.length - a.length);
const tracks = candidates[0] ?? [];

if (!tracks.length) {
  console.error("❌ Aucun track trouvé dans la page Audiomack.");
  console.error(`   Flight text length: ${flightText.length}`);
  process.exit(1);
}

console.log(`✓ ${tracks.length} tracks extraits`);
console.log(`   #1: ${tracks[0].artist} - ${tracks[0].title}`);
console.log(`   #2: ${tracks[1]?.artist} - ${tracks[1]?.title}`);
console.log(`   #3: ${tracks[2]?.artist} - ${tracks[2]?.title}`);

// Normaliser en AudiomackNormalizedEntry
function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

const entries = tracks.slice(0, 100).map((track, index) => ({
  platform: "audiomack",
  countryCode: "HT",
  rank: index + 1,
  platformTrackId: track.id?.toString() ?? null,
  title: track.title,
  artistName: track.artist,
  artworkUrl: track.image ?? track.image_base ?? null,
  artistImageUrl: track.artist_image ?? null,
  sourceTrackUrl: track.url_slug ? `https://audiomack.com${track.url_slug}` : null,
  artistSlug: slugify(track.artist),
  trackSlug: slugify(track.title),
  albumName: track.album ?? null,
  genre: track.genre ?? null,
}));

// --- Étape 3 : Extraire la date source ---
const dateMatch = html.match(/<span[^>]*>\s*Last updated:\s*<\/span>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/i);
let sourceUpdatedAt = null;
if (dateMatch) {
  const parsed = Date.parse(`${dateMatch[1].trim()} 00:00:00 UTC`);
  if (!isNaN(parsed)) sourceUpdatedAt = new Date(parsed).toISOString();
}
console.log(`   Source updated: ${sourceUpdatedAt ?? "non détecté"}`);

// --- Étape 4 : Envoyer à l'API prod ---
console.log(`\n⟳ Envoi à ${PROD_URL}/api/admin/charts/collect ...`);

// Utiliser le endpoint cron qui accepte un Bearer CRON_SECRET
// OU le endpoint collect qui accepte un Bearer ADMIN_SECRET
const SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET;

if (SECRET) {
  // Envoyer les entrées directement au endpoint collect via admin secret
  const collectRes = await fetch(`${PROD_URL}/api/admin/charts/collect-local`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entries, sourceUpdatedAt }),
  });
  const json = await collectRes.json();
  console.log(`\n${collectRes.ok && json.status !== "error" ? "✅" : "❌"} Résultat:`, JSON.stringify(json, null, 2));
} else {
  // Sauvegarder les entrées dans un fichier pour import manuel
  const fs = await import("fs");
  const outputPath = "scripts/collected-entries.json";
  fs.writeFileSync(outputPath, JSON.stringify({ entries, sourceUpdatedAt }, null, 2));
  console.log(`\n✅ ${entries.length} entrées sauvegardées dans ${outputPath}`);
  console.log("\n   Pour envoyer à prod, relance avec :");
  console.log("   set CRON_SECRET=ton_secret && node scripts/collect-local.mjs");
}
