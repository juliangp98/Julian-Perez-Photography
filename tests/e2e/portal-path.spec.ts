import type { APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore, magicLinkFor, type FakeCall } from "./support/fixtures";
import { patchProject } from "./support/test-store";
import { clientNextStep, type ClientStepContext, type ClientStepProject } from "../../src/lib/next-step";
import { portalReturnPath } from "../../src/lib/auth";
import { formatHumanDate, shiftDay, studioToday } from "../../src/lib/field-format";

// The client's path through the portal: one next step per stage
// (clientNextStep in src/lib/next-step.ts), the project page in phone order
// with the shared stage tracker, sign-in returning to the page the client came
// from, a second photographer's call sheet, the owner's "View as client", and
// the owner's emails about what clients do in the portal. The rules are
// checked directly; the pages against the test store.

const TODAY = "2026-11-25";
const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts
const ctx = (over: Partial<ClientStepContext> = {}): ClientStepContext => ({
  today: TODAY,
  discoveryCallUrl: "https://book.example.com/discovery",
  timelineCallUrl: "https://book.example.com/timeline",
  reviewUrl: "https://reviews.example.com/julian",
  questionnaireUrl: "/questionnaire/weddings?project=p",
  ...over,
});
const own = (type: string, more: Record<string, string> = {}) => ({
  type,
  url: `https://links.example.com/${type}`,
  uploadedBy: "julian",
  ...more,
});
const step = (p: ClientStepProject, c = ctx()) => clientNextStep(p, c);

test("client next step: one per stage, from booking the call to the review", () => {
  expect(step({ status: "new-inquiry" })).toMatchObject({
    title: "Book a discovery call",
    action: { href: "https://book.example.com/discovery", external: true },
  });
  expect(step({ status: "responded" }, ctx({ discoveryCallUrl: undefined }))).toEqual({
    title: "I'll be in touch soon",
    detail: "I read every inquiry and reply myself.",
  });
  expect(step({ status: "in-conversation" })?.title).toBe("Your proposal is on its way");

  // The proposal, with the date held.
  expect(step({ status: "proposal-sent", documents: [own("proposal")] }, ctx({ holdUntil: "2026-12-02" }))).toMatchObject({
    title: "Your proposal is ready",
    detail: "I'm holding your date until December 2, 2026.",
    action: { label: "View your proposal", href: "https://links.example.com/proposal" },
  });
  // A proposal the client uploaded isn't Julian's.
  expect(step({ status: "proposal-sent", documents: [own("proposal", { uploadedBy: "client" })] })?.title).toBe(
    "Your proposal is on its way",
  );

  // Reserving the date: the contract, then the retainer, with how to pay.
  expect(
    step(
      { status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] },
      ctx({ paymentLine: "Pay by Zelle." }),
    ),
  ).toMatchObject({
    title: "Sign your contract and pay the retainer",
    detail: "The retainer is due December 1, 2026. Pay by Zelle. Your date is reserved once both are in.",
    action: { label: "Sign the contract", href: "https://links.example.com/contract" },
    secondary: { label: "Pay the retainer", href: "https://links.example.com/invoice" },
  });
  expect(step({ status: "booked" })?.title).toBe("Your contract is on its way");
  expect(step({ status: "contract-signed", eventDate: "2027-06-12" })).toEqual({
    title: "You're booked",
    detail: "June 12, 2027 is yours. I'll send your planning questionnaire closer to the day.",
  });

  // Planning: the questionnaire, then the timeline call.
  expect(step({ status: "planning" })).toMatchObject({
    title: "Fill in your planning questionnaire",
    action: { href: "/questionnaire/weddings?project=p" },
  });
  expect(step({ status: "planning", questionnaireSnapshot: "{}" })?.action?.href).toBe("https://book.example.com/timeline");

  // The shoot, said by how soon it is.
  expect(step({ status: "scheduled", eventDate: "2026-11-25" })?.title).toBe("Your shoot is today");
  expect(step({ status: "scheduled", eventDate: "2026-11-26" })?.title).toBe("Your shoot is tomorrow");
  expect(step({ status: "scheduled", eventDate: "2026-11-28" })?.title).toBe("Your shoot is on Saturday");
  expect(step({ status: "scheduled", eventDate: "2026-12-20", documents: [own("timeline")] })).toMatchObject({
    title: "Your shoot is on December 20, 2026",
    action: { label: "View your timeline" },
  });

  // Editing, the highlights, the gallery and any open invoice, then the review.
  expect(step({ status: "editing" })?.title).toBe("I'm editing your photos");
  expect(step({ status: "editing", documents: [own("highlights")] })?.action?.label).toBe("View your highlights");
  expect(
    step({ status: "delivered", documents: [own("gallery"), own("invoice", { dueAt: "2026-12-10" })] }),
  ).toMatchObject({
    title: "Your gallery is ready",
    action: { label: "View your gallery" },
    secondary: { label: "Pay the invoice" },
  });
  expect(step({ status: "complete", documents: [own("gallery")] })).toMatchObject({
    title: "Leave a review",
    action: { href: "https://reviews.example.com/julian" },
    secondary: { label: "View your gallery" },
  });
  // A closed project has no step.
  expect(step({ status: "lost" })).toBeUndefined();
});

test("sign-in returns only to a plain portal page", () => {
  expect(portalReturnPath("/portal/projects/0f0e3c1a-1111-4222-8333-444455556666")).toBe(
    "/portal/projects/0f0e3c1a-1111-4222-8333-444455556666",
  );
  expect(portalReturnPath("/portal/dashboard")).toBe("/portal/dashboard");
  for (const bad of ["https://evil.example/portal/x", "//evil.example", "/portal/../admin", "/admin/projects", "/portal/x?y=1", "/portal", undefined]) {
    expect(portalReturnPath(bad), String(bad)).toBeUndefined();
  }
});

// A fresh wedding project for one test, with the address its client signs in with.
async function newProject(adminRequest: APIRequestContext, tag: string) {
  const email = `e2e-path-${tag}-${Date.now()}@example.com`;
  const res = await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Path", serviceType: "weddings", eventDate: "2027-06-12", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return { id: id as string, email };
}
const sentTo = (calls: FakeCall[], to: string) =>
  calls.filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(to));

test("the project page: the next step, the tracker, links by kind, and the plan once proposed", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "page");
  await patchProject(p.id, { plan_summary: "Getting ready at the inn, then the garden ceremony." });
  const page = await portalPage(p.email);
  await page.goto(`/portal/projects/${p.id}`);
  const next = page.getByRole("region", { name: "Your next step" });
  await expect(next).toContainText("Book a discovery call");
  await expect(page.getByText(/^Step 1 of 10: Inquiry$/)).toBeVisible();
  // Before a proposal, no plan.
  await expect(page.getByText("Getting ready at the inn")).toHaveCount(0);

  const hold = shiftDay(studioToday(), { days: 9 });
  await patchProject(p.id, {
    status: "proposal-sent",
    hold_until: hold,
    documents: [
      { id: "pr", type: "proposal", label: "Your proposal", url: "https://links.example.com/proposal", uploadedBy: "julian" },
      { id: "tl", type: "timeline", label: "Draft timeline", url: "https://links.example.com/timeline", uploadedBy: "client" },
    ],
  });
  await page.reload();
  await expect(next).toContainText("Your proposal is ready");
  await expect(next).toContainText(`I'm holding your date until ${formatHumanDate(hold)}.`);
  await expect(next.getByRole("link", { name: "View your proposal" })).toHaveAttribute(
    "href",
    "https://links.example.com/proposal",
  );
  await expect(page.getByRole("heading", { name: "Your plan", exact: true })).toBeVisible();
  await expect(page.getByText("Getting ready at the inn, then the garden ceremony.")).toBeVisible();
  // Links grouped by kind, each under its own heading.
  await expect(page.getByRole("heading", { name: "Proposal", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
  expect(scan.violations).toEqual([]);
});

test("sign-in returns to the page the client was sent from, and one project opens straight away", async ({
  adminRequest,
  page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "return");

  // Sent to sign in from the project page; the link brings them back to it.
  await page.goto(`/portal/projects/${p.id}`);
  await expect(page).toHaveURL(/\/portal\?from=/);
  await page.getByLabel("Email").fill(p.email);
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/sign-in link is on its way/)).toBeVisible();
  await page.goto(await magicLinkFor(p.email));
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${p.id}$`));

  // A link asked for with no page: the person's one project opens.
  await page.context().clearCookies();
  await page.request.post("/api/portal/request-link", { data: { email: p.email, hp_company: "" } });
  await page.goto(await magicLinkFor(p.email));
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${p.id}$`));

  // With two projects, their list.
  await adminRequest.post("/api/admin/create-project", {
    data: { email: p.email, clientName: "E2E Path", serviceType: "engagements", force: true },
  });
  await page.context().clearCookies();
  await page.request.post("/api/portal/request-link", { data: { email: p.email, hp_company: "" } });
  await page.goto(await magicLinkFor(p.email));
  await expect(page).toHaveURL(/\/portal\/dashboard$/);

  // A page that isn't a plain portal path is ignored.
  await page.context().clearCookies();
  await page.request.post("/api/portal/request-link", {
    data: { email: p.email, hp_company: "", next: "https://evil.example/portal/x" },
  });
  await page.goto(await magicLinkFor(p.email));
  await expect(page).toHaveURL(/\/portal\/dashboard$/);
});

test("a second photographer gets a call sheet, not the client's next step or thread", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "sheet");
  await patchProject(p.id, {
    status: "scheduled",
    partner_name: "Sam",
    locations: [{ label: "Stone Barn", address: "1 Farm Rd, Leesburg" }],
    documents: [
      { id: "tl", type: "timeline", label: "Day-of timeline", url: "https://links.example.com/timeline", uploadedBy: "julian" },
    ],
  });
  const second = `e2e-path-shooter-${Date.now()}@example.com`;
  const grant = await adminRequest.post("/api/admin/collaborators", {
    data: { action: "add", projectId: p.id, email: second, sendInvite: false },
  });
  expect(grant.status()).toBe(200);

  const page = await portalPage(second);
  await page.goto(`/portal/projects/${p.id}`);
  const sheet = page.getByRole("region", { name: "Call sheet" });
  await expect(sheet).toContainText("June 12, 2027");
  await expect(sheet).toContainText("E2E Path and Sam");
  await expect(sheet).toContainText("Stone Barn");
  await expect(sheet).toContainText("Day-of contact");
  await expect(sheet.getByRole("link", { name: "Day-of timeline" })).toHaveAttribute("href", "https://links.example.com/timeline");
  await expect(page.getByRole("region", { name: "Your next step" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Messages" })).toHaveCount(0);
});

test("View as client shows the client's page read-only, to the owner alone", async ({
  adminRequest,
  adminPage,
  page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "preview");
  await adminPage.goto(`/admin/projects/${p.id}`);
  await adminPage.getByRole("link", { name: "View as client" }).click();
  await expect(adminPage).toHaveURL(new RegExp(`/admin/projects/${p.id}/client$`));
  await expect(adminPage.getByText("Viewing as the client")).toBeVisible();
  await expect(adminPage.getByRole("region", { name: "Your next step" })).toContainText("Book a discovery call");
  // Nothing to send or save from here.
  await expect(adminPage.getByPlaceholder("Write to Julian…")).toHaveCount(0);
  await expect(adminPage.getByRole("heading", { name: "Update your details" })).toHaveCount(0);
  await expect(adminPage.getByRole("heading", { name: "Upload a document" })).toHaveCount(0);

  // Signed out, it's the admin sign-in.
  await page.context().clearCookies();
  await page.goto(`/admin/projects/${p.id}/client`);
  await expect(page).toHaveURL(/\/admin$/);
});

test("the owner is emailed when a client starts a project or uploads a file", async ({
  adminRequest,
  portalRequest,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "alerts");
  const client = await portalRequest(p.email);

  const started = await client.post("/api/portal/create-project", { data: { serviceType: "engagements", force: true } });
  expect(started.status()).toBe(200);
  const { id: newId } = await started.json();
  const startAlert = sentTo(await fakes.calls("resend"), OWNER).at(-1);
  expect(startAlert?.body?.subject).toBe(`New project in the portal: ${p.email}`);
  expect(String(startAlert?.body?.text)).toContain(`/admin/projects/${newId}`);

  const attached = await client.post("/api/portal/attach-document", {
    data: {
      projectId: p.id,
      url: "https://store.public.blob.vercel-storage.com/portal/floor-plan.pdf",
      label: "Floor plan.pdf",
      type: "other",
    },
  });
  expect(attached.status()).toBe(200);
  const fileAlert = sentTo(await fakes.calls("resend"), OWNER).at(-1);
  expect(fileAlert?.body?.subject).toMatch(/^New file on .+: Floor plan\.pdf$/);
  expect(String(fileAlert?.body?.text)).toContain(`/admin/projects/${p.id}?tab=links`);
});
