import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore, productionBuild } from "./support/fixtures";
import { AUTH_SECRET } from "./support/auth-secret";
import { SETTINGS } from "../../src/lib/config";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../src/lib/labels";
import { services } from "../../src/lib/services-data";
import { siteSettingsFallback } from "../../src/lib/site-settings-data";
import { SITE_SERVICES, TOOLS, notSetLine, sharedLinks, siteServices, webAddress } from "../../src/lib/admin-links";
import type { SiteSettings } from "../../src/lib/types";

// The admin Links page: the links Julian shares with clients (each with a
// Copy action), the tools he works in, and the services the site runs on,
// each badged by whether its settings are in place, with the production setup
// list first when one is still missing. Site settings come from the built-in
// fallback here (Sanity is off in the suite).

const visible = services.filter((s) => !s.hidden);

test("the shared links come from site settings and the services shown on the site", () => {
  const groups = sharedLinks(siteSettingsFallback, services);
  expect(groups.map((g) => g.title)).toEqual([
    "Booking calls",
    "Reviews",
    "Client galleries",
    "Sample galleries",
    "How to pay",
  ]);
  const [calls, reviews, galleries, samples, pay] = groups;
  const c = siteSettingsFallback.calls;
  expect(calls.links).toEqual(
    [c.discoveryCall, c.planningCall, c.weddingTimelineCall, c.venueWalkthrough].map((x) => ({
      label: x.label,
      value: x.url,
      href: x.url,
    })),
  );
  expect(reviews.links.map((l) => l.href)).toEqual([siteSettingsFallback.googleProfileUrl]);
  expect(galleries.links.map((l) => l.href)).toEqual([siteSettingsFallback.clientGalleryUrl]);
  // The built-in catalog has no sample galleries: each service shown is named.
  expect(samples.links).toEqual([]);
  expect(samples.missing).toEqual(visible.map((s) => s.title));
  expect(pay.links).toEqual(
    PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m.value), value: siteSettingsFallback.paymentInstructions[m.value] })),
  );
});

test("a link Studio has no usable value for is named, never linked", () => {
  const settings = {
    calls: {
      discoveryCall: null,
      planningCall: { label: "Book a planning call", url: "" },
      weddingTimelineCall: { label: "Timeline", url: "javascript:alert(1)" },
      venueWalkthrough: { label: "  ", url: "https://book.example.com/walk" },
    },
    googleProfileUrl: "  ",
    clientGalleryUrl: "pic-time.com/client",
    paymentInstructions: { ...siteSettingsFallback.paymentInstructions, zelle: " " },
  } as unknown as Pick<SiteSettings, "calls" | "googleProfileUrl" | "clientGalleryUrl" | "paymentInstructions">;
  const [calls, reviews, galleries, , pay] = sharedLinks(settings, [
    { title: "Weddings", sampleGalleryUrl: "https://gallery.example.com/w" },
    { title: "Modeling", hidden: true, sampleGalleryUrl: "https://gallery.example.com/m" },
    { title: "Newborn" },
  ]);
  // A blank label takes the call's own name.
  expect(calls.links).toEqual([
    { label: "Venue walkthrough", value: "https://book.example.com/walk", href: "https://book.example.com/walk" },
  ]);
  expect(calls.missing).toEqual(["Discovery call", "Book a planning call", "Timeline"]);
  expect(reviews.missing).toEqual(["Google review link"]);
  expect(galleries.missing).toEqual(["Pic-Time client login"]);
  expect(pay.missing).toEqual([paymentMethodLabel("zelle")]);
  // A hidden service is never offered, with a gallery or without.
  const samples = sharedLinks(settings, [
    { title: "Weddings", sampleGalleryUrl: "https://gallery.example.com/w" },
    { title: "Modeling", hidden: true, sampleGalleryUrl: "https://gallery.example.com/m" },
    { title: "Newborn" },
  ])[3];
  expect(samples.links.map((l) => l.label)).toEqual(["Weddings"]);
  expect(samples.missing).toEqual(["Newborn"]);

  expect(webAddress(" https://ok.example.com/x ")).toBe("https://ok.example.com/x");
  for (const bad of ["", "  ", "javascript:alert(1)", "pic-time.com", "https://has space.com", null, undefined]) {
    expect(webAddress(bad), String(bad)).toBeUndefined();
  }
  expect(notSetLine([])).toBe("");
  expect(notSetLine(["A"])).toBe("Not set in Studio yet: A.");
  expect(notSetLine(["A", "B", "C"])).toBe("Not set in Studio yet: A, B and C.");
});

test("each site service reads as set up from its settings, by name only", () => {
  const names = new Set(SETTINGS.map((s) => s.name));
  for (const g of SITE_SERVICES) {
    for (const l of g.links) for (const s of l.settings ?? []) expect(names.has(s), `${l.label}: ${s}`).toBe(true);
  }
  // A tool isn't listed again among the site services.
  const serviceHrefs = SITE_SERVICES.flatMap((g) => g.links.map((l) => l.href));
  expect(TOOLS.filter((t) => serviceHrefs.includes(t.href))).toEqual([]);
  expect(TOOLS.find((t) => t.label === "Gmail")?.href).toBe("https://mail.google.com");

  const twilio = (env: Record<string, string>) =>
    siteServices(env).flatMap((g) => g.links).find((l) => l.label === "Twilio console")!.missing;
  expect(twilio({})).toEqual(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_FROM"]);
  expect(twilio({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b" })).toEqual(["TWILIO_PHONE_FROM"]);
  expect(twilio({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_PHONE_FROM: "  " })).toEqual([
    "TWILIO_PHONE_FROM",
  ]);
  expect(twilio({ TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_PHONE_FROM: "c" })).toEqual([]);
  // A service with no setting to check reads as nothing missing (no badge).
  expect(siteServices({}).flatMap((g) => g.links).find((l) => l.label === "Sentry")!.missing).toEqual([]);
});

test("the Links page is the owner's alone", async ({ page }) => {
  await page.goto("/admin/links");
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByRole("heading", { name: "Owner sign-in" })).toBeVisible();
});

test("the setup list sits on the Links page, and the board points to it, in production only", async ({
  adminPage: page,
}) => {
  await page.goto("/admin/links");
  const fold = page.locator("details").filter({ has: page.getByRole("heading", { name: "Site services" }) });
  if (productionBuild) {
    // The suite's production build has no Sanity project, so setup is unfinished.
    await expect(fold).toHaveAttribute("open", "");
    const setup = page.locator("#setup");
    await expect(setup).toBeVisible();
    await expect(setup).toContainText("Setup isn’t finished");
    await expect(setup).toContainText("NEXT_PUBLIC_SANITY_PROJECT_ID");

    await page.goto("/admin/projects");
    await expect(page.getByText("Setup isn’t finished.")).toBeVisible();
    await expect(page.getByText("NEXT_PUBLIC_SANITY_PROJECT_ID")).toHaveCount(0);
    const pointer = page.getByRole("link", { name: "See what’s missing" });
    await expect(pointer).toHaveAttribute("href", "/admin/links#setup");
    await pointer.click();
    await expect(page).toHaveURL(/\/admin\/links#setup$/);
    await expect(page.locator("#setup")).toBeVisible();
  } else {
    await expect(fold).not.toHaveAttribute("open", "");
    await expect(page.locator("#setup")).toHaveCount(0);
    await page.goto("/admin/projects");
    await expect(page.getByRole("link", { name: "See what’s missing" })).toHaveCount(0);
  }
});

test("links to share copy in one click, and each site service shows whether it's set up", async ({
  adminPage: page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/admin/links");
  await expect(page.getByRole("heading", { name: "Links", level: 1, exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Links", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const discovery = siteSettingsFallback.calls.discoveryCall;
  const link = page.getByRole("link", { name: discovery.label, exact: true });
  await expect(link).toHaveAttribute("href", discovery.url);
  await expect(link).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: `Copy ${discovery.label}`, exact: true }).click();
  await expect(page.getByRole("button", { name: `Copied ${discovery.label}`, exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(discovery.url);

  await expect(page.getByRole("link", { name: "Google review link", exact: true })).toHaveAttribute(
    "href",
    siteSettingsFallback.googleProfileUrl!,
  );
  await expect(page.getByRole("link", { name: "Pic-Time client login", exact: true })).toHaveAttribute(
    "href",
    siteSettingsFallback.clientGalleryUrl,
  );
  await expect(page.getByText(notSetLine(visible.map((s) => s.title)), { exact: true })).toBeVisible();
  for (const m of PAYMENT_METHODS) {
    await expect(page.getByText(siteSettingsFallback.paymentInstructions[m.value], { exact: true })).toBeVisible();
  }
  for (const t of TOOLS) {
    await expect(page.getByRole("link", { name: t.label, exact: true })).toHaveAttribute("href", t.href);
  }

  // The site services, unfolded if they start folded (they open on their own
  // when setup is unfinished).
  const fold = page.locator("details").filter({ has: page.getByRole("heading", { name: "Site services" }) });
  if (!(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator("summary").click();
  const card = (label: string) => fold.locator("li").filter({ has: page.getByRole("link", { name: label, exact: true }) });
  await expect(card("Sanity Manage")).toContainText("Not set");
  await expect(card("Sanity Manage")).toContainText("NEXT_PUBLIC_SANITY_PROJECT_ID");
  await expect(card("Groq console")).toContainText("Configured");
  await expect(card("Twilio console")).toContainText("Configured");
  await expect(card("Resend")).toContainText("Configured");
  await expect(card("Google Cloud Console")).toContainText("Not set");
  await expect(card("Supabase dashboard")).toContainText(hasTestStore ? "Configured" : "Not set");
  for (const label of ["Sentry", "GitHub repository", "HSTS Preload"]) {
    await expect(card(label)).not.toContainText("Configured");
    await expect(card(label)).not.toContainText("Not set");
  }
  // The tools aren't repeated among the site services.
  await expect(fold.getByRole("link", { name: "Square dashboard" })).toHaveCount(0);
  // Only setting names are shown, never what they hold.
  const html = await page.content();
  for (const secret of ["gsk_fake_e2e", "re_fake_e2e", "e2e-cron-secret", AUTH_SECRET]) {
    expect(html).not.toContain(secret);
  }

  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
  expect(result.violations).toEqual([]);
});
