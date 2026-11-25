import type { Page } from "@playwright/test";
import { test, expect, type FakeCall } from "./support/fixtures";

// "How did you hear about me?": the curated referral dropdown shared by the
// inquiry form and every questionnaire. Options that name a specific source (a
// Facebook group, a venue, a vendor, "Other") reveal a companion input asking
// which one; channel-only options (Instagram, Google) don't. The detail travels
// as `referralOther` and reaches the owner email as "Venue: Foxchase Manor",
// while the subject keeps the short channel tag for inbox filtering.

const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts
const ownerEmails = (calls: FakeCall[]) =>
  calls.filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(OWNER));

test("inquiry form: Facebook group and Venue ask which one; Instagram doesn't", async ({ page }) => {
  await page.goto("/inquire");
  const source = page.getByLabel("How did you hear about me?");

  await source.selectOption({ label: "Facebook group" });
  const group = page.getByLabel("Which group? (optional)");
  await expect(group).toBeVisible();
  await group.fill("DMV Wedding Planning");

  // Switching channels drops the detail rather than carrying it over.
  await source.selectOption({ label: "Venue" });
  const venue = page.getByLabel("Which venue? (optional)");
  await expect(venue).toBeVisible();
  await expect(venue).toHaveValue("");

  await source.selectOption({ label: "Instagram" });
  await expect(page.getByLabel(/^Which (group|venue|vendor)\?/)).toHaveCount(0);
});

test("inquiry form: a venue named as the source reaches the owner email", async ({ page, fakes }) => {
  await page.goto("/inquire");
  await page.getByLabel("Name").fill("Lead Source Test");
  await page.getByLabel("Email").fill("lead-source@example.com");
  await page.getByLabel("Service").selectOption({ index: 1 });
  await page.getByLabel("How did you hear about me?").selectOption({ label: "Venue" });
  await page.getByLabel("Which venue? (optional)").fill("Foxchase Manor");
  await page.getByLabel("Tell me about your vision").fill("An automated test submission. Please ignore.");
  await page.getByRole("button", { name: /Send inquiry/i }).click();
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible();

  const [email] = ownerEmails(await fakes.calls("resend"));
  expect(email.body?.subject).toContain("[via: Venue]");
  expect(String(email.body?.text)).toContain("Referral:  Venue: Foxchase Manor");
});

test("inquire: each detail-capable source carries its detail; a channel-only one drops it", async ({
  request,
  fakes,
}) => {
  const cases = [
    ["facebook-group", "DMV Wedding Planning", "Facebook group: DMV Wedding Planning"],
    ["venue", "Foxchase Manor", "Venue: Foxchase Manor"],
    ["vendor", "A planner", "Planner or another vendor: A planner"],
    ["instagram", "left over from an earlier choice", "Instagram"],
  ] as const;
  for (const [referral, referralOther, shown] of cases) {
    const res = await request.post("/api/inquire", {
      data: {
        name: "Lead Source API",
        email: "lead-source-api@example.com",
        service: "weddings",
        referral,
        referralOther,
        message: `Found you through ${referralOther}.`,
      },
    });
    expect(res.status()).toBe(200);
    const email = ownerEmails(await fakes.calls("resend")).at(-1);
    expect(String(email?.body?.text)).toContain(`Referral:  ${shown}\n`);
  }
});

// Fill whatever text, date, dropdown or radio gates the on-screen section has so
// "Next →" advances (the questionnaire renders one section at a time).
async function satisfyVisible(page: Page) {
  for (const [sel, val] of [
    // DateField is a masked MM/DD/YYYY text input, so it's filled before the
    // generic text pass claims it.
    ['input[placeholder="MM/DD/YYYY"]', "08/08/2027"],
    ['input[type="number"]', "1"],
    ['input[type="time"]', "12:00"],
    ['input:not([type]), input[type="text"], textarea', "E2E test"],
  ] as const) {
    const loc = page.locator(sel);
    for (let i = 0; i < (await loc.count()); i++) {
      const el = loc.nth(i);
      if ((await el.isVisible().catch(() => false)) && !(await el.inputValue())) {
        await el.fill(val).catch(() => {});
      }
    }
  }
  const selects = page.locator("select");
  for (let i = 0; i < (await selects.count()); i++) {
    const el = selects.nth(i);
    if (!(await el.isVisible().catch(() => false)) || (await el.inputValue())) continue;
    const first = await el
      .locator("option:not([disabled])")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value).find((v) => v !== ""));
    if (first) await el.selectOption(first).catch(() => {});
  }
  const names: string[] = await page
    .locator('input[type="radio"]')
    .evaluateAll((els) => Array.from(new Set(els.map((e) => (e as HTMLInputElement).name))));
  for (const name of names) {
    if (!name) continue;
    const group = page.locator(`input[type="radio"][name="${name}"]`);
    const anyChecked = await group.evaluateAll((els) => els.some((e) => (e as HTMLInputElement).checked));
    if (!anyChecked) {
      const first = group.first();
      if (await first.isVisible().catch(() => false)) await first.check().catch(() => {});
    }
  }
}

test("questionnaire: the referral field asks which venue", async ({ page }) => {
  const params = new URLSearchParams({
    fullName: "Lead Source Questionnaire",
    email: "lead-source-q@example.com",
    phone: "(703) 555-7777",
  });
  await page.goto(`/questionnaire/family-celebrations?${params.toString()}`);

  const source = page.getByLabel("How did you find me?");
  for (let i = 0; i < 20; i++) {
    if (await source.isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: /Next →/ });
    if ((await next.count()) === 0) break;
    await satisfyVisible(page);
    await next.click();
  }

  await source.selectOption({ label: "Venue" });
  await expect(page.getByLabel("Which venue? (optional)")).toBeVisible();
  await source.selectOption({ label: "Google search" });
  await expect(page.getByLabel("Which venue? (optional)")).toHaveCount(0);
});
