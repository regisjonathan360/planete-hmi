/* Mesures du Solitaire : taille réelle des cartes, débordements, chevauchements.
   node scripts/solitaire-measure.mjs */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORTS = [
  { name: "desktop1920", width: 1920, height: 1080 },
  { name: "laptop1536", width: 1536, height: 750 },
  { name: "laptop1366", width: 1366, height: 768 },
  { name: "small1024", width: 1024, height: 768 },
  { name: "tablet768", width: 768, height: 1024 },
  { name: "mobile390", width: 390, height: 844 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

const measure = async (label) => {
  const data = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const frame = document.querySelector('[class*="frame"]');
    const frameRect = frame?.getBoundingClientRect();
    const inner = document.querySelector('[class*="frame__inner"], [class*="frame_inner"]');
    const innerRect = inner?.getBoundingClientRect();
    const transform = inner ? getComputedStyle(inner).transform : null;

    // Taille effective d'une carte (les cartes des modes portent data-cardrank).
    const card = document.querySelector("[data-cardrank]");
    const cardRect = card ? card.getBoundingClientRect() : null;

    // Débordements hors du cadre (éléments significatifs uniquement).
    const overflows = [];
    if (frameRect) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.right < frameRect.left || r.left > frameRect.right) continue;
        if (r.top > frameRect.bottom + 10) continue;
        const right = r.right - frameRect.right;
        const bottom = r.bottom - frameRect.bottom;
        if (right > 3 || bottom > 3) {
          const cls = (el.className || "").toString().slice(0, 60);
          overflows.push({
            cls,
            right: Math.round(right),
            bottom: Math.round(bottom),
            w: Math.round(r.width),
            h: Math.round(r.height),
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 24),
          });
        }
      }
    }

    // Éléments génériques : rangée du haut (talon/colonnes) et colonnes.
    const zones = {};
    const tops = [...document.querySelectorAll('[data-drop^="col-"]')].slice(0, 4);
    if (tops.length) {
      const first = tops[0].getBoundingClientRect();
      const last = tops[tops.length - 1].getBoundingClientRect();
      zones.columns = {
        y: [Math.round(first.y), Math.round(last.y + last.height)],
        w: Math.round(last.right - first.left),
      };
    }
    const fonds = [...document.querySelectorAll('[data-drop^="fond-"], [data-drop^="cell-"]')];
    if (fonds.length) zones.topRow = fonds.map((f) => {
      const r = f.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });

    return {
      vw, vh,
      frame: frameRect ? { x: Math.round(frameRect.x), y: Math.round(frameRect.y), w: Math.round(frameRect.width), h: Math.round(frameRect.height) } : null,
      inner: innerRect ? { w: Math.round(innerRect.width), h: Math.round(innerRect.height), x: Math.round(innerRect.x), y: Math.round(innerRect.y), transform } : null,
      card: cardRect ? { w: Math.round(cardRect.width), h: Math.round(cardRect.height) } : null,
      overflows: overflows.slice(0, 8),
      zones,
    };
  });
  console.log(`\n=== ${label} @${data.vw}x${data.vh}`);
  console.log(JSON.stringify(data, null, 1));
};

async function dismissCookies() {
  await page.evaluate(() => {
    document.querySelector('section[aria-labelledby="cookie-consent-title"]')?.remove();
  });
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}/arene/solitaire`, { waitUntil: "domcontentloaded" });
  await page.getByRole("dialog", { name: /Menu du Solitaire/ }).waitFor({ timeout: 60000 });
  await dismissCookies();
  await page.getByRole("button", { name: /Jouer/ }).click();
  await page.waitForTimeout(2500);
  await measure(`klondike.${vp.name}`);

  await page.goto(`${BASE}/arene/solitaire`, { waitUntil: "domcontentloaded" });
  await page.getByRole("dialog", { name: /Menu du Solitaire/ }).waitFor({ timeout: 60000 });
  await dismissCookies();
  await page.getByRole("button", { name: /Modes/ }).click();
  await page.waitForTimeout(250);
  const modes = ["Spider", "FreeCell", "Pyramid"];
  let first = true;
  for (const mode of modes) {
    if (!first) {
      await page.getByRole("button", { name: /^Jeu$/ }).click();
      await page.waitForTimeout(200);
      await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
    } else {
      await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
      first = false;
    }
    await page.waitForTimeout(2000);
    await measure(`${mode.toLowerCase()}.${vp.name}`);
  }
  await page.evaluate(() => localStorage.clear());
}

await browser.close();