import { chromium } from "playwright";

const PLAYLIST_ID = "37i9dQZEVXbMDoHDwVN2tF";
const URL = `https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
});

console.log(`Opening ${URL}...`);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4000);

// Try various selectors
const selectors = ["[data-testid='tracklist-row']", ".track-row", "li", "[role='row']", "[data-testid]"];
for (const sel of selectors) {
  const count = await page.locator(sel).count();
  if (count > 0) console.log(`${sel}: ${count}`);
}

// Dump page text to find track names
const text = await page.evaluate(() => document.body.innerText);
const lines = text.split("\n").filter(l => l.trim()).slice(0, 30);
console.log("\nFirst 30 lines of text:");
lines.forEach((l, i) => console.log(`  ${i}: ${l}`));

await browser.close();
