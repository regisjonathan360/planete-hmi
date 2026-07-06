/**
 * Tests end-to-end (Playwright) — Module Classements.
 * Prérequis : `npx playwright install` + serveur dev + base Supabase locale.
 * Exécuter : `npx playwright test`
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("/charts — page publique", () => {
  test("affiche les 5 rangées avec les plateformes attendues", async ({ page }) => {
    await page.goto(`${BASE}/charts`);
    await expect(page.locator("h1")).toContainText("Classements");
    const rows = page.locator("section.row");
    await expect(rows).toHaveCount(5);
    await expect(page.locator("text=YouTube")).toBeVisible();
    await expect(page.locator("text=Spotify")).toBeVisible();
    await expect(page.locator("text=Audiomack")).toBeVisible();
    await expect(page.locator("text=Apple Music")).toBeVisible();
    await expect(page.locator("text=TikTok")).toBeVisible();
  });

  test("bouton Top 20 mène à la page détail", async ({ page }) => {
    await page.goto(`${BASE}/charts`);
    await page.locator("a:has-text('Voir le Top 20')").first().click();
    await expect(page).toHaveURL(/\/charts\/(youtube|spotify|audiomack|apple-music|tiktok)/);
    await expect(page.locator("table.t20")).toBeVisible();
  });

  test("page méthodologie affiche la déclaration d'indépendance", async ({ page }) => {
    await page.goto(`${BASE}/charts/methodology`);
    await expect(page.locator("text=indépendant")).toBeVisible();
  });

  test("badge Mise à jour en attente visible quand is_stale", async ({ page }) => {
    await page.goto(`${BASE}/charts`);
    await expect(page.locator("text=Mise à jour en attente")).toBeVisible();
  });
});

test.describe("/admin — protection", () => {
  test("redirige vers login si non connecté", async ({ page }) => {
    await page.goto(`${BASE}/admin/charts`);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login avec bon compte affiche le tableau de bord", async ({ page }) => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("input[type=email]", "admin@hmi.test");
    await page.fill("input[type=password]", "hmiadmin123");
    await page.click("button[type=submit]");
    await expect(page.locator("h1")).toContainText("Tableau de bord", { timeout: 10000 });
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("swipe visible, pas de débordement horizontal", async ({ page }) => {
    await page.goto(`${BASE}/charts`);
    const body = page.locator("body");
    const box = await body.boundingBox();
    expect(box).toBeTruthy();
    if (box) expect(box.width).toBeLessThanOrEqual(375);
  });
});
