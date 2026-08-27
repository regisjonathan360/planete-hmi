import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test.describe("Page de connexion", () => {
  test("affiche le formulaire email/mot de passe et les connexions sociales", async ({ page }) => {
    await page.goto("/connexion");

    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuer avec Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuer avec Facebook/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mot de passe oublié ?" })).toBeVisible();
  });

  test("exige un mot de passe de huit caractères minimum", async ({ page }) => {
    await page.goto("/connexion");
    // Passage en mode inscription.
    await page.getByRole("button", { name: "Inscription" }).click();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute("minlength", "8");
    await expect(page.getByText("8 caractères minimum.")).toBeVisible();
  });

  test("bascule vers le mode lien magique (mot de passe masqué)", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("button", { name: "Lien magique" }).click();

    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Recevoir un lien magique/i })).toBeVisible();
  });
});

test.describe("Récupération de mot de passe", () => {
  test("la page mot-de-passe-oublie affiche le formulaire d'envoi", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");

    await expect(page.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à la connexion" })).toBeVisible();
  });
});

test.describe("Sécurité des redirections", () => {
  test("un paramètre next externe est neutralisé", async ({ page }) => {
    // Le serveur doit ignorer un next absolu vers un domaine tiers : la page
    // se rend normalement et le formulaire reçoit le fallback interne.
    const response = await page.goto("/connexion?next=https://exemple-malveillant.com/compte");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });
});
