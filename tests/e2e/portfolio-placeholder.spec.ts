import { test, expect } from "@playwright/test";

// A photo portfolio with no images must show its own "Gallery coming soon"
// placeholder — never the wedding-films video placeholder. Regression guard for
// the video/photo discriminator in /portfolio/[category]: the Sanity projection
// returns `videos: null` for photo portfolios, so the renderer must treat only
// an actual array as a video portfolio. A `!== undefined` check let the Sanity
// null read as a video portfolio, which showed every photo gallery the
// wedding-films "coming soon" copy.
test("photo portfolio placeholder shows the gallery copy, not the films copy", async ({
  page,
}) => {
  await page.goto("/portfolio/maternity");

  await expect(
    page.getByRole("heading", { name: "Maternity", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Gallery coming soon/i)).toBeVisible();
  await expect(page.getByText(/Wedding films coming soon/i)).toHaveCount(0);
});
