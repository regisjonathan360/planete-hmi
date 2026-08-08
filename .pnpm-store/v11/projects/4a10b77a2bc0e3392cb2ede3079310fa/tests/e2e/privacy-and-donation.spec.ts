import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("le rappel de soutien revient après vingt secondes puis respecte le refus permanent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tout refuser" }).click();

  const prompt = page.getByRole("complementary", { name: /Aidez Planète HMI/i });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: /Fermer, l’appel au soutien/i }).click();
  await expect(prompt).toBeHidden();
  await page.waitForTimeout(20_300);
  await expect(prompt).toBeVisible();

  await prompt.getByRole("button", { name: "Ne plus afficher" }).click();
  await expect(prompt).toBeHidden();
  await page.reload();
  await expect(prompt).toBeHidden();
});

test("le consentement peut être refusé, personnalisé et rouvert depuis le pied de page", async ({ page }) => {
  await page.goto("/cookies");

  const dialog = page.getByRole("dialog", { name: /Votre vie privée/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Personnaliser" }).click();
  await expect(dialog.getByText("Fonctionnement essentiel")).toBeVisible();
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: "Enregistrer mes choix" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Gérer mes cookies" }).first().click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();

  const storedConsent = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("planete-hmi-cookie-consent") ?? "null"),
  );
  expect(storedConsent).toMatchObject({ necessary: true, analytics: false });
});
