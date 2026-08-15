/* Audit visuel du Solitaire de l'Arène : captures + erreurs console.
   Lancement : node scripts/solitaire-audit.mjs (serveur dev sur :3000 requis). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/regis/AppData/Local/Temp/opencode/solitaire-shots";
mkdirSync(OUT, { recursive: true });

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

const allErrors = [];
page.on("pageerror", (err) => allErrors.push(`PAGEERROR: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") allErrors.push(`CONSOLE: ${msg.text()}`);
});

async function shot(name, viewport) {
  await page.screenshot({ path: `${OUT}/${viewport}-${name}.png` });
}

async function dismissCookieBanner() {
  await page.evaluate(() => {
    const banner = document.querySelector(
      'section[aria-labelledby="cookie-consent-title"]'
    );
    banner?.remove();
  });
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    allErrors.push(`SHOT-FAIL ${label}: ${err.message.split("\n")[0]}`);
  }
}

async function openModesMenu() {
  await page.getByRole("button", { name: /Modes/ }).click();
  await page.waitForTimeout(250);
}

async function captureKlondike(vp) {
  await safe(`menu-${vp.name}`, async () => {
    await page.goto(`${BASE}/arene/solitaire`, { waitUntil: "domcontentloaded" });
    await page.getByRole("dialog", { name: /Menu du Solitaire/ }).waitFor({ timeout: 60000 });
    await dismissCookieBanner();
    await shot("menu", vp.name);
    await page.getByRole("button", { name: /Jouer/ }).click();
    await page.waitForTimeout(2500);
    await shot("klondike", vp.name);
  });
}

async function captureModes(vp) {
  await safe(`modes-${vp.name}`, async () => {
    await page.goto(`${BASE}/arene/solitaire`, { waitUntil: "domcontentloaded" });
    await page.getByRole("dialog", { name: /Menu du Solitaire/ }).waitFor({ timeout: 60000 });
    await dismissCookieBanner();
    await openModesMenu();

    const modes = ["Spider", "FreeCell", "Pyramid"];
    let first = true;
    for (const mode of modes) {
      if (!first) {
        await page.getByRole("button", { name: /^Jeu$/ }).click();
        await page.waitForTimeout(200);
        await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
        await page.waitForTimeout(2000);
      } else {
        await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
        await page.waitForTimeout(2000);
        first = false;
      }
      await shot(mode.toLowerCase(), vp.name);
    }
  });
}

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await captureKlondike(vp);
  await captureModes(vp);
  await page.evaluate(() => localStorage.clear());
}

console.log("ERRORS:");
console.log(allErrors.length ? allErrors.join("\n") : "(aucune)");
await browser.close();