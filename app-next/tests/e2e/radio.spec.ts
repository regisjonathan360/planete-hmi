import { expect, test } from "playwright/test";

const track = (id: string, title: string) => ({
  id,
  title,
  artist_name: "Artiste test",
  audio_url: "/games/solitaire/ding.mp3",
  duration_seconds: 1,
  source: "manual",
  is_active: true,
  play_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

test("la radio enchaîne automatiquement les pistes préchargées", async ({ page }) => {
  await page.route("**/api/radio/playlist", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tracks: [track("radio-test-a", "Piste test A"), track("radio-test-b", "Piste test B")],
        config: { preload_count: 1, crossfade_duration_ms: 0 },
      }),
    });
  });
  await page.route("**/api/radio/play", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto("/");
  const playButton = page.getByTitle("Lecture");
  await expect(playButton).toBeEnabled({ timeout: 10000 });
  await playButton.click();
  await expect(page.getByText("Piste test A", { exact: true })).toBeVisible();
  await expect(page.getByText("Piste test B", { exact: true })).toBeVisible({ timeout: 15000 });
});

test("la navigation interne ne remonte pas le lecteur radio", async ({ page }) => {
  let playlistCalls = 0;
  await page.route("**/api/radio/playlist", async (route) => {
    playlistCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tracks: [track("radio-navigation-a", "Piste navigation")],
        config: { preload_count: 1, crossfade_duration_ms: 0 },
      }),
    });
  });
  await page.route("**/api/radio/play", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto("/");
  await expect(page.getByTitle("Lecture")).toBeEnabled({ timeout: 10000 });
  await page.getByTitle("Lecture").click();
  await expect(page.getByText("Piste navigation", { exact: true })).toBeVisible();
  await expect.poll(() => playlistCalls).toBe(1);

  await page.getByRole("link", { name: "Classements", exact: true }).first().click();
  await expect(page).toHaveURL(/\/charts\/?$/);
  await expect(page.getByText("Piste navigation", { exact: true })).toBeVisible();
  expect(playlistCalls).toBe(1);
});
