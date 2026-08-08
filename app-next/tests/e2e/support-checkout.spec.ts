import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://www.paypal.com/sdk/js**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.paypal = {
        HostedButtons: ({ hostedButtonId }) => ({
          render: async (selector) => {
            const container = document.querySelector(selector);
            if (!container || hostedButtonId !== "JDCLSL36KW6QQ") {
              throw new Error("Invalid PayPal hosted button configuration");
            }
            const iframe = document.createElement("iframe");
            iframe.title = "PayPal hosted button";
            iframe.style.width = "100%";
            iframe.style.height = "48px";
            container.appendChild(iframe);
          },
        }),
      };`,
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "planete-hmi-cookie-consent",
      JSON.stringify({
        version: 1,
        necessary: true,
        analytics: false,
        decidedAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
      }),
    );
  });
});

test("affiche un checkout compact et charge le bouton PayPal officiel", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "Soutenir Planète HMI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moyen de paiement" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await expect(page.locator('img[src="/brand/payments/moncash-icon.jpg"]')).toBeVisible();
  await expect(page.locator('img[src="/brand/payments/natcash-icon.jpg"]')).toBeVisible();
  await expect(page.locator('img[src="/brand/payments/paypal-icon.jpg"]')).toBeVisible();

  await page.getByRole("button", { name: /PayPal/ }).click();
  await expect(page.locator("#paypal-container-JDCLSL36KW6QQ iframe").first()).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByText("Le bouton PayPal n’a pas pu se charger")).toHaveCount(0);
  await expect(
    page.locator('script[src*="paypal.com/sdk/js"][src*="components=hosted-buttons"]'),
  ).toHaveCount(1);
});

test("affiche les QR MonCash et NatCash dans le parcours manuel", async ({ page }) => {
  await page.route("**/api/contributions/create", async (route) => {
    const request = route.request().postDataJSON() as {
      amount: number;
      provider: "moncash" | "natcash";
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        contribution: {
          reference: `HMI-TEST-${request.provider.toUpperCase()}`,
          provider: request.provider,
          amount: request.amount,
          currency: "HTG",
          status: "PENDING",
          payment_mode: "MANUAL",
        },
      }),
    });
  });

  await page.goto("/support");
  await page.getByRole("button", { name: "Continuer avec MonCash" }).click();
  await expect(page.getByAltText("QR code de transfert MonCash")).toBeVisible();
  await expect(page.getByText("+509 3732-9331")).toBeVisible();
  await expect(page.getByText("Régis Jonathan")).toBeVisible();

  await page.getByRole("button", { name: /NatCash/ }).first().click();
  await page.getByRole("button", { name: "Afficher les instructions NatCash" }).click();
  await expect(page.getByAltText("QR code de transfert NatCash")).toBeVisible();
  await expect(page.getByText("+509 4159-8724")).toBeVisible();
  await expect(page.getByText("Jonathan Regis")).toBeVisible();
  await expect(page.getByText("Numéro ou identifiant de transaction")).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("garde le paiement lisible sans débordement horizontal", async ({ page }) => {
    await page.goto("/support");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(375);
    await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Moyen de paiement" })).toBeVisible();
  });
});
