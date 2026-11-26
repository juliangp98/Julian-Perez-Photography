import type { Page } from "@playwright/test";

// Walking a questionnaire without coupling to the exact schema: the shared
// details are prefilled through the address, and a generic filler satisfies
// whatever gates each section has.

// Fill whatever text, date, dropdown or radio gates the on-screen section has so
// "Next →" advances (the questionnaire renders one section at a time).
export async function satisfyVisible(page: Page) {
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

// Advance until the last section, where Submit replaces "Next →".
export async function advanceToLastSection(page: Page) {
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole("button", { name: /Next →/ });
    if ((await next.count()) === 0) break;
    await satisfyVisible(page);
    await next.click();
  }
}
