import { test, expect, type Page } from "@playwright/test";

// "How did you hear about me?" — the curated referral dropdown shared by the
// inquiry form and every questionnaire. Options that name a specific source
// (a Facebook group, a venue, a vendor, "Other") reveal a companion input
// asking which one; channel-only options (Instagram, Google) don't. The detail
// travels as `referralOther` and is folded into the owner email + client
// record as "Venue — Foxchase Manor".
//
// Submissions rely on the dev-mode fallback (no RESEND_API_KEY), so nothing is
// emailed and the AI assessment / owner text alert never run here.

test("inquiry form: Facebook group and Venue ask which one; Instagram doesn't", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.30.1" });
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

test("inquiry form: submits with a venue named as the source", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.30.2" });
  await page.goto("/inquire");

  await page.getByLabel("Name").fill("Lead Source Test");
  await page.getByLabel("Email").fill("lead-source@example.com");
  await page.getByLabel("Service").selectOption({ index: 1 });
  await page.getByLabel("How did you hear about me?").selectOption({ label: "Venue" });
  await page.getByLabel("Which venue? (optional)").fill("Foxchase Manor");
  await page
    .getByLabel("Tell me about your vision")
    .fill("Automated test submission — please ignore.");

  await page.getByRole("button", { name: /Send inquiry/i }).click();

  // 30s covers the route's cold compile on a fresh dev server (see
  // inquire.spec.ts).
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
    timeout: 30_000,
  });
});

test("inquire: accepts each detail-capable source with its detail", async ({
  request,
}) => {
  for (const [referral, referralOther] of [
    ["facebook-group", "DMV Wedding Planning"],
    ["venue", "Foxchase Manor"],
    ["vendor", "A planner"],
  ] as const) {
    const res = await request.post("/api/inquire", {
      headers: { "x-forwarded-for": "10.99.30.3" },
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
    expect((await res.json()).ok).toBe(true);
  }
});

// Fill whatever text / date / dropdown / radio gates the on-screen section has
// so "Next →" advances (the questionnaire renders one section at a time).
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
    if (!(await el.isVisible().catch(() => false)) || (await el.inputValue())) {
      continue;
    }
    const first = await el
      .locator("option:not([disabled])")
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).find((v) => v !== ""),
      );
    if (first) await el.selectOption(first).catch(() => {});
  }
  const names: string[] = await page
    .locator('input[type="radio"]')
    .evaluateAll((els) =>
      Array.from(new Set(els.map((e) => (e as HTMLInputElement).name))),
    );
  for (const name of names) {
    if (!name) continue;
    const group = page.locator(`input[type="radio"][name="${name}"]`);
    const anyChecked = await group.evaluateAll((els) =>
      els.some((e) => (e as HTMLInputElement).checked),
    );
    if (!anyChecked) {
      const first = group.first();
      if (await first.isVisible().catch(() => false)) {
        await first.check().catch(() => {});
      }
    }
  }
}

test("questionnaire: the referral field asks which venue", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.30.4" });
  const params = new URLSearchParams({
    fullName: "Lead Source Questionnaire",
    email: "lead-source-q@example.com",
    phone: "(703) 555-7777",
    bookingStatus: "I'm already booked — let's plan",
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
