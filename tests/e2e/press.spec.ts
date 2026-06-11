import { test, expect } from "@playwright/test";

// Press features: the "Featured in" strip on the home page and the
// "As featured in" line under the About bio, both driven by the single
// list in src/lib/press-data.ts.

const VOYAGE_URL =
  "https://voyagebaltimore.com/interview/community-highlights-meet-julian-perez-of-julian-perez-photography";

test("home: the Featured in strip links to the VoyageBaltimore interview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Featured in", { exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: /voyagebaltimore/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", VOYAGE_URL);
  // External link hygiene — opens in a new tab without a referrer.
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noreferrer");
});

test("about: renders the story bio and the As-featured-in line", async ({
  page,
}) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "Hi, I'm Julian.", level: 1 }),
  ).toBeVisible();
  // A line from the new story copy (fallback content in the test env).
  await expect(
    page.getByText("the missing piece: storytelling"),
  ).toBeVisible();
  await expect(page.getByText(/as featured in/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /voyagebaltimore/i }),
  ).toHaveAttribute("href", VOYAGE_URL);
});
