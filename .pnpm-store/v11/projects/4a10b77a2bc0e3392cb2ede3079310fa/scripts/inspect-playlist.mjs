import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
});
await page.goto("https://audiomack.com/geo-charts/playlist/haiti", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

// Try various selectors
const selectors = [".MusicListRow", ".MusicList-row", ".Music-row", "[data-testid='MusicListRow']", ".ChartsItem", ".MusicCard", "article", ".Music"];
for (const sel of selectors) {
  const count = await page.locator(sel).count();
  console.log(`${sel}: ${count}`);
}

// Inspect the showcase list rows
const rowInfo = await page.evaluate(() => {
  const list = document.querySelector("[class*='MusicShowcaseList']");
  if (!list) return "no list found";
  // Find direct row children
  const rows = list.querySelectorAll("a[href*='/song/'], [class*='ListRow'], [class*='listRow'], li");
  const sample = [];
  const seen = new Set();
  document.querySelectorAll("a[href*='/song/']").forEach((a) => {
    const href = a.getAttribute("href");
    if (seen.has(href)) return;
    seen.add(href);
    sample.push({ href, text: a.textContent?.trim().slice(0, 60) });
  });
  return { rowCount: rows.length, songLinks: sample.length, sample: sample.slice(0, 5) };
});
console.log("\nRow info:", JSON.stringify(rowInfo, null, 2));

await browser.close();
