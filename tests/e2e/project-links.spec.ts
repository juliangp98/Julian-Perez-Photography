import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject } from "./support/test-store";

// Links and files on a project: the proposal, contract, invoice, highlights and
// gallery links Julian adds from the admin, and the files a client uploads. The
// owner's changes go through /api/admin/update; a client's upload through
// /api/portal/attach-document, which only takes the kinds a client may add.
// Adding highlights or the gallery moves the project along and emails no one.
// The portal shows the client every entry and how they're paying, never the
// budget; a second photographer sees neither money nor paperwork.

const link = (path: string) => `https://links.example.com/${path}`;

test("admin update: a link change needs the owner's session", async ({ request }) => {
  const res = await request.post("/api/admin/update", {
    data: { id: "p1", addDocument: { type: "gallery", label: "Gallery", url: link("gallery") } },
  });
  expect(res.status()).toBe(401);
});

test("admin update: a link must be a web address, of a kind Julian can add", async ({
  adminRequest: request,
}) => {
  const rejected = [
    { type: "gallery", label: "Gallery", url: "javascript:alert(1)" },
    { type: "gallery", label: "Gallery", url: "not a link" },
    { type: "gallery", label: "", url: link("gallery") },
    // Filed by the site itself, never added by hand.
    { type: "questionnaire-pdf", label: "Answers", url: link("answers.pdf") },
    { type: "made-up", label: "Something", url: link("x") },
    { type: "invoice", label: "Invoice", url: link("invoice"), dueAt: "June 1" },
  ];
  for (const addDocument of rejected) {
    const res = await request.post("/api/admin/update", { data: { id: "p1", addDocument } });
    expect(res.status(), JSON.stringify(addDocument)).toBe(400);
  }
});

test("admin update: accepts an add, a change and a removal when authenticated", async ({
  adminRequest: request,
}) => {
  // No project has this id, so nothing changes, but the route accepts each shape.
  for (const change of [
    { addDocument: { type: "invoice", label: "Retainer", url: link("invoice"), dueAt: "2027-06-01" } },
    { patchDocument: { id: "abc", paidAt: "2027-05-20" } },
    { patchDocument: { id: "abc", paidAt: null } },
    { removeDocumentId: "abc" },
    { fields: { paymentMethod: "zelle" } },
    { fields: { paymentMethod: "" } },
  ]) {
    const res = await request.post("/api/admin/update", { data: { id: "p1", ...change } });
    expect(res.status(), JSON.stringify(change)).toBe(200);
    expect((await res.json()).ok).toBe(true);
  }
  const unknown = await request.post("/api/admin/update", {
    data: { id: "p1", fields: { paymentMethod: "barter" } },
  });
  expect(unknown.status()).toBe(400);
});

// A fresh wedding project for one test, with the address its client signs in with.
async function newProject(adminRequest: APIRequestContext, tag: string) {
  const email = `e2e-links-${tag}-${Date.now()}@example.com`;
  const res = await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Links", serviceType: "weddings", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  const update = async (data: Record<string, unknown>) => {
    const r = await adminRequest.post("/api/admin/update", { data: { id, ...data } });
    expect(r.status(), JSON.stringify(data)).toBe(200);
  };
  return { id: id as string, email, update };
}

test("links: highlights move the project to Editing and the gallery to Delivered, with no email", async ({
  adminRequest,
  adminPage,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "advance");

  await p.update({ addDocument: { type: "highlights", label: "Highlights", url: link("highlights") } });
  // A save of other fields carries no status, so it leaves the new one alone.
  await p.update({ fields: { partnerName: "Sam" } });
  await adminPage.goto(`/admin/projects/${p.id}?tab=links`);
  await expect(adminPage.locator("#project-status")).toHaveValue("editing");

  await p.update({ addDocument: { type: "gallery", label: "Gallery", url: link("gallery") } });
  // A later highlights link never moves a delivered project back.
  await p.update({ addDocument: { type: "highlights", label: "More highlights", url: link("more") } });
  await adminPage.reload();
  await expect(adminPage.locator("#project-status")).toHaveValue("delivered");

  const links = adminPage.locator("#links");
  await expect(links.getByRole("link", { name: "More highlights" })).toHaveAttribute("href", link("more"));
  // The gallery has a template that carries its link, so it offers the
  // hand-off: Compose opens on that template, filled with the link, in view.
  await links.getByRole("link", { name: "Tell the client" }).click();
  await expect(adminPage).toHaveURL(/compose=gallery-delivery/);
  await expect(adminPage.getByLabel("Email body")).toHaveValue(new RegExp(link("gallery")));
  await expect(adminPage.getByRole("heading", { name: "Compose email" })).toBeInViewport();

  // A replacement gallery link added after Compose opened on that template
  // gets a fresh draft carrying the new link.
  await adminPage.getByRole("navigation", { name: "Project" }).getByRole("link", { name: "Links & files" }).click();
  await links.getByLabel("Kind").selectOption({ label: "Gallery" });
  await links.getByLabel("Link", { exact: true }).fill(link("gallery-final"));
  await links.getByLabel("Shown as (optional)").fill("Final gallery");
  await links.getByRole("button", { name: "Add link" }).click();
  await expect(links.getByRole("status").filter({ hasText: "Added." })).toBeVisible();
  // Only the entry the email would carry (the newest gallery) offers it.
  await expect(links.getByRole("link", { name: "Tell the client" })).toHaveCount(1);
  await links
    .getByRole("listitem")
    .filter({ hasText: "Final gallery" })
    .getByRole("link", { name: "Tell the client" })
    .click();
  await expect(adminPage.getByLabel("Email body")).toHaveValue(new RegExp(link("gallery-final")));

  // Adding a link tells the client nothing: that's a Compose email.
  const sent = (await fakes.calls("resend")).filter(
    (c) => c.path === "/emails" && [c.body?.to].flat().includes(p.email),
  );
  expect(sent).toEqual([]);
});

test("links: the status in the header follows a link that moved it, and saving details keeps it", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "form");
  await page.goto(`/admin/projects/${p.id}?tab=links`);
  await expect(page.locator("#project-status")).toHaveValue("new-inquiry");

  const links = page.locator("#links");
  await links.getByLabel("Kind").selectOption({ label: "Highlights" });
  await links.getByLabel("Link", { exact: true }).fill(link("highlights"));
  await links.getByRole("button", { name: "Add link" }).click();
  await expect(links.getByRole("status").filter({ hasText: "Added." })).toBeVisible();
  // No reload: the header shows the new status, and the tracker the new stage.
  await expect(page.locator("#project-status")).toHaveValue("editing");
  await expect(page.getByText(/^Step \d+ of \d+: Editing$/)).toBeVisible();

  // Saving the details never writes a status back.
  await page.goto(`/admin/projects/${p.id}?tab=details`);
  await page.getByLabel("Partner name").fill("Sam");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.locator("#project-status")).toHaveValue("editing");
  await expect(page.getByLabel("Partner name")).toHaveValue("Sam");
});

test("links: two added at the same moment are both kept", async ({ adminRequest, adminPage }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "pair");
  await Promise.all([
    p.update({ addDocument: { type: "proposal", label: "Proposal", url: link("proposal") } }),
    p.update({ addDocument: { type: "contract", label: "Contract", url: link("contract") } }),
  ]);
  await adminPage.goto(`/admin/projects/${p.id}?tab=links`);
  const links = adminPage.locator("#links");
  await expect(links.getByRole("link", { name: "Proposal" })).toBeVisible();
  await expect(links.getByRole("link", { name: "Contract" })).toBeVisible();
});

test("links: the owner adds an invoice, marks it paid and removes it from the project page", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "page");
  await page.goto(`/admin/projects/${p.id}?tab=links`);
  const links = page.locator("#links");
  await expect(links.getByText(/Nothing here yet/)).toBeVisible();

  // A link that isn't a web address is caught before it's sent.
  await links.getByLabel("Kind").selectOption({ label: "Invoice" });
  await links.getByLabel("Link", { exact: true }).fill("ftp://files.example.com/invoice");
  await links.getByRole("button", { name: "Add link" }).click();
  await expect(links.getByRole("alert")).toContainText("starting with https://");

  await links.getByLabel("Link", { exact: true }).fill(link("retainer"));
  await links.getByLabel("Shown as (optional)").fill("Retainer invoice");
  await links.getByRole("button", { name: "Add link" }).click();
  await expect(links.getByRole("status").filter({ hasText: "Added." })).toBeVisible();
  const row = links.getByRole("listitem").filter({ hasText: "Retainer invoice" });
  await expect(row.getByRole("link", { name: "Retainer invoice" })).toHaveAttribute("href", link("retainer"));
  await expect(row).toContainText("Invoice · Julian");
  await expect(row).toContainText("Not paid yet");

  await row.getByRole("button", { name: "Mark paid" }).click();
  await expect(links.getByRole("status").filter({ hasText: "Marked paid." })).toBeVisible();
  await expect(row).toContainText(/Paid \w+ \d+, \d{4}/);
  await expect(row.getByRole("button", { name: "Mark unpaid" })).toBeVisible();

  const scan = await new AxeBuilder({ page })
    .include("#links")
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(scan.violations).toEqual([]);

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(links.getByRole("status").filter({ hasText: "Removed." })).toBeVisible();
  await expect(links.getByRole("link", { name: "Retainer invoice" })).toHaveCount(0);
});

test("portal: a client can upload a timeline, never a contract", async ({
  adminRequest,
  adminPage,
  portalRequest,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "upload");
  const portal = await portalRequest(p.email);
  const file = "https://store.public.blob.vercel-storage.com/portal/day-of.pdf";
  const attach = (type: string) =>
    portal.post("/api/portal/attach-document", {
      data: { projectId: p.id, url: file, label: "Day-of timeline.pdf", type },
    });

  for (const type of ["contract", "invoice", "proposal", "gallery"]) {
    expect((await attach(type)).status(), type).toBe(400);
  }
  expect((await attach("timeline")).status()).toBe(200);

  await adminPage.goto(`/admin/projects/${p.id}?tab=links`);
  const row = adminPage.locator("#links").getByRole("listitem").filter({ hasText: "Day-of timeline.pdf" });
  await expect(row).toContainText("Timeline · Client");
  await expect(adminPage.locator("#links").getByRole("listitem")).toHaveCount(1);
});

// A project with money, paperwork and a shared timeline on it.
async function bookedProject(adminRequest: APIRequestContext, tag: string) {
  const p = await newProject(adminRequest, tag);
  await p.update({ fields: { package: "Silver", budget: "$3,000", paymentMethod: "zelle" } });
  await p.update({ addDocument: { type: "invoice", label: "Retainer invoice", url: link("retainer"), dueAt: "2027-06-01" } });
  await p.update({ addDocument: { type: "timeline", label: "Day-of timeline", url: link("timeline") } });
  await p.update({ addDocument: { type: "gallery", label: "Gallery", url: link("gallery") } });
  return p;
}

test("portal: the client sees their links, the invoice's due date and how they're paying, not the budget", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await bookedProject(adminRequest, "client");
  const page = await portalPage(p.email);
  await page.goto(`/portal/projects/${p.id}`);

  // Delivered, so the next step is the gallery, with the open invoice beside it.
  const next = page.getByRole("region", { name: "Your next step" });
  await expect(next.getByRole("link", { name: "View your gallery" })).toHaveAttribute("href", link("gallery"));
  await expect(next.getByRole("link", { name: "Pay the invoice" })).toHaveAttribute("href", link("retainer"));
  const invoice = page.getByRole("link", { name: /Retainer invoice/ });
  await expect(invoice).toHaveAttribute("href", link("retainer"));
  await expect(invoice).toContainText("Due June 1, 2027");
  // Links are grouped by kind, which reads as a word, not a stored slug.
  await expect(page.getByRole("heading", { name: "Invoice", exact: true })).toBeVisible();
  await expect(page.getByText("Paying by")).toBeVisible();
  await expect(page.getByText("Zelle", { exact: true })).toBeVisible();
  // The how-to-pay line for that method sits under it.
  await expect(
    page.getByText("Pay by Zelle. Ask me for the details if you don't have them."),
  ).toBeVisible();
  await expect(page.getByText("Silver", { exact: true })).toBeVisible();

  await expect(page.getByText("Budget")).toHaveCount(0);
  await expect(page.getByText("$3,000")).toHaveCount(0);

  // The upload picker offers only the kinds a client may add.
  await expect(page.getByLabel("Document type").getByRole("option")).toHaveText([
    "Timeline",
    "Moodboard",
    "General",
  ]);
});

test("portal: a second photographer sees the timeline, not the money or the paperwork", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await bookedProject(adminRequest, "second");
  // The client's planning answers: some about the shoot, some about the
  // booking (the tier, an add-on), and one key the questionnaire doesn't know.
  await patchProject(p.id, {
    questionnaire_snapshot: JSON.stringify({
      bookingStatus: "I'm already booked, let's plan",
      package: "Silver",
      essentialsSecondShooter: "Yes",
      gettingReady: "Yes",
      gettingReadyAddress: "12 Garden Lane, Fairfax, VA",
      legacyNote: "Booked the Silver tier",
    }),
  });
  const second = `e2e-links-shooter-${Date.now()}@example.com`;
  const grant = await adminRequest.post("/api/admin/collaborators", {
    data: { action: "add", projectId: p.id, email: second, sendInvite: false },
  });
  expect(grant.status()).toBe(200);

  const page = await portalPage(second);
  await page.goto(`/portal/projects/${p.id}`);
  await expect(page.getByText("Shared with you")).toBeVisible();
  await expect(page.getByRole("link", { name: /Day-of timeline/ })).toHaveAttribute("href", link("timeline"));
  // The planning answers they shoot from are there; the booking ones are not.
  await expect(page.getByText("Would you like getting-ready coverage?")).toBeVisible();
  await expect(page.getByText("12 Garden Lane, Fairfax, VA")).toBeVisible();

  for (const hidden of [
    "Budget",
    "$3,000",
    "Package",
    "Silver",
    "already booked",
    "second-shooter add-on",
    "legacyNote",
    "Paying by",
    "Zelle",
    "Retainer invoice",
  ]) {
    await expect(page.getByText(hidden), hidden).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: /View your gallery/ })).toHaveCount(0);
  // The same holds for what the page was sent, not only what it draws.
  const html = await page.content();
  for (const hidden of ["$3,000", "Silver", "already booked", link("retainer"), link("gallery")]) {
    expect(html, hidden).not.toContain(hidden);
  }
});
