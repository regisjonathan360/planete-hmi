#!/usr/bin/env node
/**
 * Collecte Audiomack Haiti — 100 musiques via navigateur headless (Playwright).
 *
 * Deux sources possibles (env SOURCE) :
 *   - "chart"    → https://audiomack.com/top/songs?country=haiti
 *                  (Top Songs Chart officiel ; clic "Load More" jusqu'à 100)
 *   - "playlist" → https://audiomack.com/geo-charts/playlist/haiti
 *                  (Weekly playlist ; 100 tracks dans le payload React Flight)
 *
 * Usage :
 *   SOURCE=chart node scripts/collect-playwright.mjs
 *   SOURCE=playlist node scripts/collect-playwright.mjs
 *
 * Env :
 *   SOURCE       — "chart" (défaut) ou "playlist"
 *   CRON_SECRET  — secret pour envoyer à l'API prod
 *   PROD_URL     — défaut https://planete-hmi.vercel.app
 *   TARGET_COUNT — nombre de tracks visés (défaut 100)
 */
import { chromium } from "playwright";

const PROD_URL = process.env.PROD_URL || "https://planete-hmi.vercel.app";
const TARGET = parseInt(process.env.TARGET_COUNT || "100", 10);
const SOURCE = (process.env.SOURCE || "chart").toLowerCase();

const CHART_URL = "https://audiomack.com/top/songs?country=haiti";
const PLAYLIST_URL = "https://audiomack.com/geo-charts/playlist/haiti";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

// ---- Parser React Flight (pour la playlist) ----
function extractFlightTracks(html) {
  const PUSH = "self.__next_f.push(";
  const chunks = [];
  let from = 0;
  while (from < html.length) {
    const start = html.indexOf(PUSH, from);
    if (start === -1) break;
    const argStart = start + PUSH.length;
    let depth = 1, i = argStart, inStr = false, esc = false;
    for (; i < html.length && depth > 0; i++) {
      const c = html[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
      else { if (c === '"') inStr = true; else if (c === "(") depth++; else if (c === ")") depth--; }
    }
    try {
      const parsed = JSON.parse(html.slice(argStart, i - 1));
      if (Array.isArray(parsed)) parsed.forEach((p) => { if (typeof p === "string") chunks.push(p); });
    } catch {}
    from = i;
  }
  const flight = chunks.join("");

  // Trouver le plus grand tableau "tracks":[...]
  const arrays = [];
  const key = '"tracks":';
  let searchFrom = 0;
  while (searchFrom < flight.length) {
    const keyIndex = flight.indexOf(key, searchFrom);
    if (keyIndex === -1) break;
    const valueStart = keyIndex + key.length;
    // readBalancedJson
    const opener = flight[valueStart];
    if (opener === "[") {
      const stack = [];
      let inString = false, escaped = false, end = -1;
      for (let j = valueStart; j < flight.length; j++) {
        const c = flight[j];
        if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
        if (c === '"') inString = true;
        else if (c === "[" || c === "{") stack.push(c === "[" ? "]" : "}");
        else if (c === "]" || c === "}") { if (stack.pop() !== c) break; if (stack.length === 0) { end = j; break; } }
      }
      if (end !== -1) {
        try {
          const parsed = JSON.parse(flight.slice(valueStart, end + 1));
          if (Array.isArray(parsed) && parsed[0]?.title && parsed[0]?.artist) arrays.push(parsed);
        } catch {}
      }
    }
    searchFrom = valueStart + 1;
  }
  arrays.sort((a, b) => b.length - a.length);
  return arrays[0] ?? [];
}

console.log(`⟳ Source: ${SOURCE === "playlist" ? "Playlist Weekly" : "Top Songs Chart"}`);
console.log("⟳ Lancement du navigateur headless…");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ userAgent: UA });

let tracks = [];

if (SOURCE === "playlist") {
  console.log(`⟳ Ouverture de ${PLAYLIST_URL}…`);
  await page.goto(PLAYLIST_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const html = await page.content();
  const rawTracks = extractFlightTracks(html);
  tracks = rawTracks.map((t, i) => ({
    rank: i + 1,
    artist: t.artist,
    title: t.title,
    url_slug: t.url_slug ? `/${t.uploader?.url_slug ?? "audiomack"}/song/${t.url_slug}` : null,
    image: t.image ?? t.image_base ?? null,
    genre: t.genre ?? null,
    album: t.album || null,
  })).filter((t) => t.artist && t.title);
} else {
  console.log(`⟳ Ouverture de ${CHART_URL}…`);
  await page.goto(CHART_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".ChartsItem", { timeout: 30000 });

  let previousCount = 0, stableRounds = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    const count = await page.locator(".ChartsItem").count();
    console.log(`   ${count} tracks chargés…`);
    if (count >= TARGET) break;
    if (count === previousCount) { if (++stableRounds >= 3) break; } else stableRounds = 0;
    previousCount = count;
    const loadMore = page.locator("button.LoadMoreBtn, button:has-text('Load More')").first();
    if (await loadMore.count() === 0) break;
    try {
      await loadMore.scrollIntoViewIfNeeded();
      await loadMore.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    } catch { break; }
  }

  tracks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".ChartsItem")).map((item, index) => {
      const rankText = item.querySelector(".ChartRank")?.textContent?.trim() ?? "";
      const artistEl = item.querySelector(".ChartsItem-artist a");
      const titleEl = item.querySelector(".ChartsItem-title a");
      const imgEl = item.querySelector("img.ChartImage, img[data-testid='ChartImage']");
      return {
        rank: parseInt(rankText) || index + 1,
        artist: artistEl?.textContent?.trim() ?? null,
        title: titleEl?.textContent?.trim() ?? null,
        url_slug: artistEl?.getAttribute("href") ?? null,
        image: imgEl?.getAttribute("src") ?? null,
        genre: null,
        album: null,
      };
    }).filter((t) => t.artist && t.title);
  });
}

await browser.close();

if (!tracks.length) {
  console.error("❌ Aucun track extrait.");
  process.exit(1);
}

console.log(`\n✓ ${tracks.length} tracks extraits`);
console.log(`   #1: ${tracks[0].artist} - ${tracks[0].title}`);
console.log(`   #2: ${tracks[1]?.artist} - ${tracks[1]?.title}`);
console.log(`   #3: ${tracks[2]?.artist} - ${tracks[2]?.title}`);

const entries = tracks.slice(0, TARGET).map((track, index) => ({
  platform: "audiomack",
  countryCode: "HT",
  rank: index + 1,
  platformTrackId: track.url_slug ?? `${SOURCE}-${index + 1}`,
  title: track.title,
  artistName: track.artist,
  artworkUrl: track.image ?? null,
  artistImageUrl: null,
  sourceTrackUrl: track.url_slug ? `https://audiomack.com${track.url_slug}` : null,
  artistSlug: slugify(track.artist),
  trackSlug: slugify(track.title),
  albumName: track.album ?? null,
  genre: track.genre ?? null,
}));

const SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
if (!SECRET) {
  const fs = await import("fs");
  fs.writeFileSync("scripts/collected-entries.json", JSON.stringify({ entries }, null, 2));
  console.log(`\n✅ ${entries.length} entrées sauvegardées (pas de CRON_SECRET pour l'envoi).`);
  process.exit(0);
}

console.log(`\n⟳ Envoi de ${entries.length} entrées à ${PROD_URL}…`);
const res = await fetch(`${PROD_URL}/api/admin/charts/collect-local`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  body: JSON.stringify({ entries, sourceUpdatedAt: null }),
});
const json = await res.json();
console.log(`\n${res.ok && json.status !== "error" ? "✅" : "❌"}`, JSON.stringify(json, null, 2));
