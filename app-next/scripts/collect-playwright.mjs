#!/usr/bin/env node
/**
 * Collecte Audiomack Top Songs Haiti — 100 musiques via navigateur headless.
 *
 * La page /top/songs?country=haiti n'affiche que 20 tracks dans le HTML initial.
 * Les 80 restants sont chargés dynamiquement au clic sur "Load More".
 * Playwright pilote un vrai navigateur pour cliquer "Load More" jusqu'à
 * obtenir 100 tracks, puis extrait le classement dans le bon ordre.
 *
 * Usage :
 *   node scripts/collect-playwright.mjs
 *
 * Env :
 *   CRON_SECRET  — secret pour envoyer à l'API prod
 *   PROD_URL     — défaut https://planete-hmi.vercel.app
 *   TARGET_COUNT — nombre de tracks visés (défaut 100)
 */
import { chromium } from "playwright";

const PROD_URL = process.env.PROD_URL || "https://planete-hmi.vercel.app";
const TARGET = parseInt(process.env.TARGET_COUNT || "100", 10);
const CHART_URL = "https://audiomack.com/top/songs?country=haiti";

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

console.log("⟳ Lancement du navigateur headless…");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
});

console.log(`⟳ Ouverture de ${CHART_URL}…`);
await page.goto(CHART_URL, { waitUntil: "networkidle", timeout: 60000 });

// Attendre les premières entrées
await page.waitForSelector(".ChartsItem", { timeout: 30000 });

// Cliquer "Load More" jusqu'à atteindre TARGET tracks
let previousCount = 0;
let stableRounds = 0;
for (let attempt = 0; attempt < 30; attempt++) {
  const count = await page.locator(".ChartsItem").count();
  console.log(`   ${count} tracks chargés…`);

  if (count >= TARGET) break;
  if (count === previousCount) {
    stableRounds++;
    if (stableRounds >= 3) {
      console.log("   Plus de nouvelles entrées, arrêt.");
      break;
    }
  } else {
    stableRounds = 0;
  }
  previousCount = count;

  // Cliquer le bouton "Load More"
  const loadMore = page.locator("button.LoadMoreBtn, button:has-text('Load More')").first();
  if (await loadMore.count() === 0) {
    console.log("   Bouton 'Load More' introuvable, arrêt.");
    break;
  }
  try {
    await loadMore.scrollIntoViewIfNeeded();
    await loadMore.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } catch {
    console.log("   Impossible de cliquer 'Load More', arrêt.");
    break;
  }
}

// Extraire les tracks dans l'ordre
const tracks = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll(".ChartsItem"));
  return items.map((item, index) => {
    const rankText = item.querySelector(".ChartRank")?.textContent?.trim() ?? "";
    const rank = parseInt(rankText) || index + 1;
    const artistEl = item.querySelector(".ChartsItem-artist a");
    const titleEl = item.querySelector(".ChartsItem-title a");
    const imgEl = item.querySelector("img.ChartImage, img[data-testid='ChartImage']");
    const artist = artistEl?.textContent?.trim() ?? null;
    const title = titleEl?.textContent?.trim() ?? null;
    const href = artistEl?.getAttribute("href") ?? null;
    const image = imgEl?.getAttribute("src") ?? null;
    return { rank, artist, title, url_slug: href, image };
  }).filter((t) => t.artist && t.title);
});

await browser.close();

if (!tracks.length) {
  console.error("❌ Aucun track extrait.");
  process.exit(1);
}

console.log(`\n✓ ${tracks.length} tracks extraits`);
console.log(`   #1: ${tracks[0].artist} - ${tracks[0].title}`);
console.log(`   #2: ${tracks[1]?.artist} - ${tracks[1]?.title}`);
console.log(`   #3: ${tracks[2]?.artist} - ${tracks[2]?.title}`);

// Normaliser
const entries = tracks.slice(0, TARGET).map((track, index) => ({
  platform: "audiomack",
  countryCode: "HT",
  rank: index + 1,
  platformTrackId: track.url_slug ?? `chart-${index + 1}`,
  title: track.title,
  artistName: track.artist,
  artworkUrl: track.image ?? null,
  artistImageUrl: null,
  sourceTrackUrl: track.url_slug ? `https://audiomack.com${track.url_slug}` : null,
  artistSlug: slugify(track.artist),
  trackSlug: slugify(track.title),
  albumName: null,
  genre: null,
}));

// Envoyer à l'API
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
