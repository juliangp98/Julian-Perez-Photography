import { test, expect, type Page } from "@playwright/test";

// A6/C4 — every bundled service's questionnaire ends with the same generated
// "Related sessions" prompt, listing the OTHER services in its bundle group.
// To reach that final section without coupling to the exact schema, the shared
// details are prefilled via URL and a generic filler satisfies whatever
// required date / radio gates each intermediate section has, then advances.

// Fill the current section's required-able inputs generically: any empty
// date/number/time field, and the first option of each radio group with nothing
// chosen. (The form renders one section at a time, so these target the section
// currently on screen.)
async function satisfyVisible(page: Page) {
  for (const [sel, val] of [
    // DateField is a masked MM/DD/YYYY text input (placeholder), not a native
    // date input; number/time stay native.
    ['input[placeholder="MM/DD/YYYY"]', "08/08/2027"],
    ['input[type="number"]', "1"],
    ['input[type="time"]', "12:00"],
  ] as const) {
    const loc = page.locator(sel);
    for (let i = 0; i < (await loc.count()); i++) {
      const el = loc.nth(i);
      if ((await el.isVisible().catch(() => false)) && !(await el.inputValue())) {
        await el.fill(val).catch(() => {});
      }
    }
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

test("questionnaire: a bundled service ends with the consistent bundle prompt", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.22.1" });
  const params = new URLSearchParams({
    fullName: "Bundle Prompt Test",
    email: "bundle-prompt@example.com",
    phone: "(703) 555-7777",
    bookingStatus: "I'm already booked — let's plan",
    package: "Still deciding",
  });
  await page.goto(`/questionnaire/maternity?${params.toString()}`);

  // Advance until the final section (Submit replaces "Next →").
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole("button", { name: /Next →/ });
    if ((await next.count()) === 0) break;
    await satisfyVisible(page);
    await next.click();
  }

  await expect(
    page.getByRole("heading", { name: "Related sessions" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Interested in adding any of these/i),
  ).toBeVisible();
  // A maternity bundle sibling renders as an option.
  await expect(page.getByText(/Newborn/i).first()).toBeVisible();
});

test("questionnaire: a non-bundled service has no bundle prompt", async ({
  page,
}) => {
  // Graduation isn't in any bundle group, so it never gets the section.
  await page.goto("/questionnaire/graduation");
  await expect(page.getByText("Related sessions")).toHaveCount(0);
});
