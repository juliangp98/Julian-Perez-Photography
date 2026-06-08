import { test, expect } from "@playwright/test";

// Client galleries page (/client). Public render smoke: the page leads with the
// Pic-Time embed and closes with the "Galleries & project portal" access
// callout (moved below the reviews), so this asserts both render and that the
// callout sits beneath the embed.

test("client galleries: renders the heading, embed, and access callout below it", async ({
  page,
}) => {
  await page.goto("/client");

  await expect(
    page.getByRole("heading", { name: "Your gallery", level: 1 }),
  ).toBeVisible();

  const embed = page.getByTitle("Pic-Time client galleries");
  await expect(embed).toBeVisible();

  const callout = page.getByRole("heading", {
    name: "Galleries & project portal",
  });
  await expect(callout).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Pic-Time/ }),
  ).toBeVisible();

  // The access callout now sits below the embed (it used to lead the page).
  const embedBox = await embed.boundingBox();
  const calloutBox = await callout.boundingBox();
  expect(embedBox).not.toBeNull();
  expect(calloutBox).not.toBeNull();
  expect(calloutBox!.y).toBeGreaterThan(embedBox!.y);
});
