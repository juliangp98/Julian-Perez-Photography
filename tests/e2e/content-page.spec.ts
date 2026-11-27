import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { discoveryGuide } from "../../src/lib/discovery-guides";
import { EMAIL_TEMPLATES, GROUPED_TEMPLATES } from "../../src/lib/email/email-pipeline";
import { templateEffectsLine } from "../../src/lib/email/send-effects";
import { statusTitle } from "../../src/lib/labels";
import { bookingTerms, services } from "../../src/lib/services-data";

// The admin Content page: what Julian says to clients. The call guide for each
// kind of shoot, every email template by stage with what sending it does, each
// service's collections, then the website copy drafter and the alt-text tool.
// Content comes from the built-in catalog here (Sanity is off in the suite),
// and the AI replies from the fake provider.

const scan = async (page: Page) => {
  // Folded content counts too.
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
  expect(result.violations).toEqual([]);
};
const sectionTitles = (page: Page) => page.locator("details > summary > span.font-serif").allTextContents();

test("booking terms read as Studio sets them, with 0 days as none set", () => {
  const unset = "Not set in Studio";
  expect(bookingTerms({})).toEqual([
    { label: "Retainer", value: unset },
    { label: "Date hold", value: unset },
    { label: "Gallery turnaround", value: unset },
  ]);
  expect(bookingTerms({ retainerPercent: 30, holdDays: 7, turnaroundDays: 28 }).map((t) => t.value)).toEqual([
    "30%",
    "7 days",
    "28 days",
  ]);
  expect(bookingTerms({ retainerPercent: 0, holdDays: 0, turnaroundDays: 0 }).map((t) => t.value)).toEqual([
    "0%",
    unset,
    unset,
  ]);
  expect(bookingTerms({ holdDays: 1 })[1].value).toBe("1 day");
  // Studio can hand back nulls for fields never filled in.
  const nulls = { retainerPercent: null, holdDays: null, turnaroundDays: null } as unknown as Parameters<
    typeof bookingTerms
  >[0];
  expect(bookingTerms(nulls).map((t) => t.value)).toEqual([unset, unset, unset]);
});

test("the Content page is the owner's alone", async ({ page }) => {
  for (const path of ["/admin/content", "/admin/content?tab=emails", "/admin/content?tab=copy"]) {
    await page.goto(path);
    expect(new URL(page.url()).pathname, path).toBe("/admin");
    await expect(page.getByRole("heading", { name: "Owner sign-in" })).toBeVisible();
  }
});

test("call guides: one per kind of shoot, read as the Call tab draws them", async ({ adminPage: page, fakes }) => {
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Content", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Content" }).getByRole("link", { name: "Call guides" }),
  ).toHaveAttribute("aria-current", "page");

  // No service yet: the general guide.
  const general = discoveryGuide(undefined);
  await expect(page.getByText("Projects with no service yet use the general guide.")).toBeVisible();
  expect(await sectionTitles(page)).toEqual(general.sections.map((s) => s.title));
  const people = general.sections.find((s) => s.id === "people")!;
  await expect(page.getByText(people.questions![0].ask, { exact: true })).toBeVisible();

  // Picking a service opens its guide.
  await page.getByLabel("Guide for").selectOption("weddings");
  await page.waitForURL(/service=weddings/);
  await expect(page.getByText("Weddings projects use the couples guide.")).toBeVisible();
  expect(await sectionTitles(page)).toEqual(discoveryGuide("weddings").sections.map((s) => s.title));

  // A service's own sections: the film adds one and drops the question it covers.
  await page.goto("/admin/content?service=wedding-films");
  expect(await sectionTitles(page)).toEqual(discoveryGuide("wedding-films").sections.map((s) => s.title));
  const filmAsk = discoveryGuide("weddings")
    .sections.find((s) => s.id === "priorities")!
    .questions!.find((q) => q.id === "film")!.ask;
  await expect(page.getByText(filmAsk, { exact: true })).toHaveCount(0);
  await page.goto("/admin/content?service=engagements-couples");
  const engagements = discoveryGuide("engagements-couples");
  expect(await sectionTitles(page)).toEqual(engagements.sections.map((s) => s.title));
  // Its own opener, drawn among the section's talking points (folded text
  // counts).
  const open = engagements.sections.find((s) => s.id === "open")!;
  const openFold = page.locator("details").filter({ has: page.getByText(open.title, { exact: true }) });
  await expect(openFold).toContainText(open.say!.at(-1)!);
  await expect(openFold).not.toContainText("ongratulations");

  // A hidden service still has its guide, marked as hidden on the site.
  await page.goto("/admin/content?service=modeling");
  await expect(page.getByText("Modeling projects use the individual guide.")).toBeVisible();
  await expect(page.getByLabel("Guide for").locator("option", { hasText: "Modeling (hidden on the site)" })).toHaveCount(1);

  // Anything else reads as no service.
  for (const q of ["service=nope", "service=constructor", "service=__proto__", "service=weddings&service=newborn"]) {
    await page.goto(`/admin/content?${q}`);
    await expect(page.getByText("Projects with no service yet use the general guide."), q).toBeVisible();
  }
  // The guides are read from code: no AI.
  expect((await fakes.calls("ai")).filter((c) => c.path === "/chat/completions")).toEqual([]);
  await scan(page);
});

test("emails: every template by stage, with what sending it does and its words as Compose starts them", async ({
  adminPage: page,
}) => {
  await page.goto("/admin/content?tab=emails");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(GROUPED_TEMPLATES.map((g) => statusTitle(g.stage)));
  await expect(page.locator("details")).toHaveCount(EMAIL_TEMPLATES.length);
  const lines = new Map<string, number>();
  for (const t of EMAIL_TEMPLATES) {
    await expect(page.getByText(t.name, { exact: true }), t.id).toBeVisible();
    lines.set(templateEffectsLine(t), (lines.get(templateEffectsLine(t)) ?? 0) + 1);
  }
  for (const [line, count] of lines) await expect(page.getByText(line, { exact: true }), line).toHaveCount(count);

  // Opened, a template shows its subject and body with the tokens unfilled.
  const reply = EMAIL_TEMPLATES.find((t) => t.id === "inquiry-reply")!;
  await page.getByText(reply.name, { exact: true }).click();
  const opened = page.locator("details[open]");
  await expect(opened.getByText(reply.subject, { exact: true })).toBeVisible();
  await expect(opened).toContainText("{{");
  // Reading only: nothing here sends or copies.
  await expect(page.getByRole("button", { name: /^(send|copy)\b/i })).toHaveCount(0);
  await scan(page);
});

test("collections: each service's packages and booking terms, hidden services last", async ({ adminPage: page }) => {
  await page.goto("/admin/content?tab=collections");
  const ordered = [...services.filter((s) => !s.hidden), ...services.filter((s) => s.hidden)];
  // Each summary starts with the service's title (a badge may follow it).
  await expect(page.locator("details > summary > span:first-child")).toHaveText(ordered.map((s) => s.title));
  const card = (title: string) => page.locator("details").filter({ has: page.getByText(title, { exact: true }) });
  await expect(card("Modeling")).toContainText("Hidden on the site");

  const weddings = services.find((s) => s.slug === "weddings")!;
  const panel = card("Weddings");
  await panel.locator("summary").click();
  await expect(panel).toContainText(weddings.packages[0].name);
  await expect(panel).toContainText(weddings.packages[0].price);
  await expect(panel).toContainText(weddings.packages[0].inclusions[0]);
  await expect(panel).toContainText(weddings.addOns![0].name);
  // The built-in catalog carries no booking terms or sample gallery.
  await expect(panel.getByText("Not set in Studio", { exact: true })).toHaveCount(3);
  await expect(panel.getByText("No sample gallery in Studio yet.")).toBeVisible();
  await scan(page);
});

test("website copy: one drafter for journal posts and page copy, beside the alt-text tool", async ({
  adminPage: page,
  fakes,
}) => {
  await page.goto("/admin/content?tab=copy");
  await expect(page.getByRole("heading", { name: "Journal posts and page copy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Portfolio image alt text" })).toBeVisible();
  // The meta-description drafter is gone.
  await expect(page.getByText(/meta description/i)).toHaveCount(0);

  // Pages the site doesn't show aren't offered.
  await expect(page.getByLabel("What to draft").locator("option", { hasText: "Modeling" })).toHaveCount(0);

  // A journal post from a topic.
  await page.getByLabel("What to draft").selectOption("journal");
  await expect(page.getByLabel("What to do")).toHaveCount(0);
  await page.getByLabel("Topic or brief").fill("Why I shoot weddings documentary-style");
  await fakes.script({
    replies: [JSON.stringify({ title: "Documentary weddings", excerpt: "A teaser.", body: "One.\n\nTwo.", tags: ["weddings"] })],
  });
  await page.getByRole("button", { name: "Draft post" }).click();
  await expect(page.getByText("Documentary weddings", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Title" })).toBeVisible();

  // Switching to a page clears the post, then drafts that page's copy.
  await page.getByLabel("What to draft").selectOption("service:weddings");
  await expect(page.getByRole("button", { name: "Copy Title" })).toHaveCount(0);
  await expect(page.getByLabel("What to do")).toBeVisible();
  await fakes.script({
    replies: [JSON.stringify({ tagline: "Your day, as it was", description: "Told as it happened.", intro: [] })],
  });
  await page.getByRole("button", { name: "Polish copy" }).click();
  await expect(page.getByText("Your day, as it was", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Tagline" })).toBeVisible();
  await scan(page);
});

test("website copy: a draft or an error never stays on screen under a new choice", async ({
  adminPage: page,
  fakes,
}) => {
  await page.goto("/admin/content?tab=copy");
  // An error clears when the choice changes. Unscripted, the fake provider's
  // plain reply isn't a draft.
  await page.getByLabel("What to draft").selectOption("journal");
  await page.getByLabel("Topic or brief").fill("A topic");
  await page.getByRole("button", { name: "Draft post" }).click();
  await expect(page.getByText("Couldn't read the draft. Try again.")).toBeVisible();
  await page.getByLabel("What to draft").selectOption("service:weddings");
  await expect(page.getByText("Couldn't read the draft. Try again.")).toHaveCount(0);

  // A reply to a request made before the change is dropped.
  await page.getByLabel("What to draft").selectOption("journal");
  await fakes.script({
    replies: [JSON.stringify({ title: "A late post", excerpt: "", body: "One.", tags: [] })],
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/admin/draft-copy", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Draft post" }).click();
  await expect(page.getByRole("button", { name: "Drafting…" })).toBeVisible();
  await page.getByLabel("What to draft").selectOption("service:weddings");
  const answered = page.waitForResponse("**/api/admin/draft-copy");
  release();
  // Let the late reply be read and any render it causes land before checking.
  await (await answered).finished();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await expect(page.getByText("A late post", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy Title" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Polish copy" })).toBeEnabled();
});

test("an unknown tab opens the call guides", async ({ adminPage: page }) => {
  for (const q of ["tab=meta", "tab=", "tab=emails&tab=copy"]) {
    await page.goto(`/admin/content?${q}`);
    await expect(
      page.getByRole("navigation", { name: "Content" }).getByRole("link", { name: "Call guides" }),
      q,
    ).toHaveAttribute("aria-current", "page");
  }
});
