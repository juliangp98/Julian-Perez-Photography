import type { APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore, magicLinkFor, type FakeCall } from "./support/fixtures";
import { patchProject } from "./support/test-store";
import {
  clientNextStep,
  shootPassed,
  stillReserving,
  type ClientStepContext,
  type ClientStepProject,
} from "../../src/lib/next-step";
import { portalReturnPath } from "../../src/lib/auth";
import { planningCallFor, thankYouCalls } from "../../src/lib/project-links";
import { formatHumanDate, settledEventDate, shiftDay, studioToday } from "../../src/lib/field-format";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  shootStage,
  shownLabel,
  shownStatus,
  stageLine,
  stagesFor,
} from "../../src/lib/client-status";
import { advanceToLastSection, satisfyVisible } from "./support/questionnaire";

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
  planningCall: { kind: "timeline", url: "https://book.example.com/timeline" },
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
  // A proposal sent without a call: ready, not a call to book.
  expect(step({ status: "responded", documents: [own("proposal")] })).toMatchObject({
    title: "Your proposal is ready",
    action: { label: "View your proposal" },
  });
  // The proposal link on before the email that carries it: it's ready.
  expect(step({ status: "in-conversation", documents: [own("proposal")] })).toMatchObject({
    title: "Your proposal is ready",
    action: { label: "View your proposal", href: "https://links.example.com/proposal" },
  });

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
  // The invoice can come before the contract: it's payable, or paid.
  expect(step({ status: "booked", documents: [own("invoice", { dueAt: "2026-12-01" })] })).toMatchObject({
    title: "Your contract is on its way",
    detail: "The retainer is due December 1, 2026.",
    secondary: { label: "Pay the retainer", href: "https://links.example.com/invoice" },
  });
  expect(step({ status: "booked", documents: [own("invoice", { paidAt: "2026-11-20" })] })).toEqual({
    title: "Your retainer is in",
    detail: "Thank you. Your contract is on its way.",
  });
  // An overdue retainer says it was due.
  expect(step({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-11-20" })] })?.detail).toBe(
    "The retainer was due November 20, 2026. Your date is reserved once both are in.",
  );
  // The retainer is the invoice the contract email names (openInvoice): one
  // due now before one due later.
  expect(
    step({
      status: "booked",
      documents: [
        own("contract"),
        own("invoice", { dueAt: "2027-05-01", url: "https://links.example.com/balance" }),
        own("invoice", { url: "https://links.example.com/retainer" }),
      ],
    })?.secondary?.href,
  ).toBe("https://links.example.com/retainer");
  // A contract with no invoice yet asks only for the signature.
  expect(step({ status: "booked", documents: [own("contract")] }, ctx({ paymentLine: "Pay by card." }))).toEqual({
    title: "Sign your contract",
    detail: "The invoice for the retainer is on its way.",
    action: { label: "Sign the contract", href: "https://links.example.com/contract", external: true },
  });
  // Julian's contract on a lead means they said yes: the date is being
  // reserved (stillReserving), and the step asks them to sign and pay.
  for (const status of ["new-inquiry", "in-conversation", "proposal-sent"]) {
    const documents = [own("contract"), own("invoice")];
    expect(stillReserving({ status, documents }, false, TODAY), status).toBe(true);
    expect(stillReserving({ status, documents: [own("invoice")] }, false, TODAY), status).toBe(false);
    expect(step({ status, documents, reserving: true })?.title, status).toBe("Sign your contract and pay the retainer");
  }
  // Paid, a lead still reads Reserving your date until the welcome goes out.
  expect(
    stillReserving({ status: "in-conversation", documents: [own("contract"), own("invoice", { paidAt: "2026-11-20" })] }, false, TODAY),
  ).toBe(true);
  // Once one is paid, the date is reserved: no ask to pay, and a balance
  // left open isn't called the retainer.
  const paid = step({
    status: "booked",
    documents: [
      own("contract"),
      own("invoice", { paidAt: "2026-11-20" }),
      own("invoice", { dueAt: "2027-06-01", url: "https://links.example.com/balance" }),
    ],
  });
  expect(paid).toMatchObject({ title: "Your retainer is in", action: { label: "View your contract" } });
  expect(paid?.secondary).toBeUndefined();
  expect(paid?.detail).not.toMatch(/retainer is due|Pay/);

  expect(step({ status: "contract-signed", eventDate: "2027-06-12" })).toEqual({
    title: "You're booked",
    detail: "June 12, 2027 is yours. Your planning questionnaire is below whenever you're ready, and I'll remind you closer to the day.",
  });
  // Inside the two months before the shoot the questionnaire is due soon,
  // and the week of it, the step is the shoot itself.
  expect(step({ status: "contract-signed", eventDate: "2026-12-20" })?.detail).toBe(
    "December 20, 2026 is yours. Your planning questionnaire is below whenever you're ready, and I'll remind you soon.",
  );
  expect(step({ status: "contract-signed", eventDate: "2026-11-26" })?.title).toBe("Your shoot is tomorrow");
  expect(step({ status: "planning", eventDate: "2026-11-26", questionnaireSnapshot: "{}" })?.title).toBe(
    "Your shoot is tomorrow",
  );
  // Answers sent before the booking aren't asked for again.
  expect(step({ status: "contract-signed", questionnaireSnapshot: "{}" })?.detail).toBe(
    "You're all set. I'll be in touch to plan closer to the day.",
  );
  // A date that's settled is named; a hedge isn't.
  expect(settledEventDate("2027-06-12")).toBe("June 12, 2027");
  expect(settledEventDate("fall 2027")).toBe("Fall 2027");
  expect(settledEventDate("June 2027")).toBe("June 2027");
  expect(settledEventDate("Nov 20-21, 2026")).toBe("Nov 20-21, 2026");
  expect(settledEventDate("2027")).toBe("2027");
  for (const hedge of ["TBD June 6, 2027", "June or July 2027", "sometime in 2027", "TBD", ""]) {
    expect(settledEventDate(hedge), hedge).toBe("");
  }
  expect(step({ status: "contract-signed", eventDate: "TBD June 6, 2027" }, ctx({ questionnaireUrl: undefined }))?.detail).toBe(
    "You're all set. I'll be in touch to plan closer to the day.",
  );
  // Text with no year names no date.
  expect(step({ status: "contract-signed", eventDate: "TBD" }, ctx({ questionnaireUrl: undefined }))?.detail).toBe(
    "You're all set. I'll be in touch to plan closer to the day.",
  );
  // A date given as text is named as they gave it.
  expect(step({ status: "contract-signed", eventDate: "Fall 2027" }, ctx({ questionnaireUrl: undefined }))?.detail).toBe(
    "Fall 2027 is yours. I'll be in touch to plan closer to the day.",
  );
  // A service with no questionnaire isn't promised one.
  expect(step({ status: "contract-signed" }, ctx({ questionnaireUrl: undefined }))?.detail).toBe(
    "You're all set. I'll be in touch to plan closer to the day.",
  );

  // Planning: the questionnaire, then the call that plans the day, then the
  // timeline once it's on the project.
  expect(step({ status: "planning" })).toMatchObject({
    title: "Fill in your planning questionnaire",
    action: { href: "/questionnaire/weddings?project=p" },
  });
  expect(step({ status: "planning", questionnaireSnapshot: "{}" })).toMatchObject({
    title: "Book your timeline call",
    action: { href: "https://book.example.com/timeline" },
  });
  expect(
    step(
      { status: "planning", questionnaireSnapshot: "{}" },
      ctx({ planningCall: { kind: "planning", url: "https://book.example.com/planning" } }),
    ),
  ).toMatchObject({ title: "Book your planning call", action: { href: "https://book.example.com/planning" } });
  expect(step({ status: "planning", questionnaireSnapshot: "{}", documents: [own("timeline")] })).toMatchObject({
    title: "Your timeline is ready",
    action: { label: "View your timeline", href: "https://links.example.com/timeline" },
  });
  // The wedding timeline call is for a wedding or its film; every other
  // service books the planning call.
  const calls = {
    planningCall: { label: "Book a planning call", url: "https://book.example.com/planning" },
    weddingTimelineCall: { label: "Book a wedding timeline call", url: "https://book.example.com/timeline" },
  };
  expect(planningCallFor("wedding-films", calls).kind).toBe("timeline");
  expect(planningCallFor("newborn", calls)).toMatchObject({ kind: "planning", url: "https://book.example.com/planning" });
  // The thank-you page offers that one first, then the others that fit.
  const walk = { label: "Book a venue walkthrough", url: "https://book.example.com/walkthrough" };
  const labels = (service: string) => thankYouCalls(service, { ...calls, venueWalkthrough: walk }).map((c) => c.label);
  expect(labels("weddings")).toEqual(["Book a wedding timeline call", "Book a planning call", "Book a venue walkthrough"]);
  expect(labels("wedding-films")).toEqual(["Book a wedding timeline call", "Book a planning call"]);
  expect(labels("newborn")).toEqual(["Book a planning call"]);

  // A booked project the questionnaire moved on before the booking was done
  // is still reserving its date until the welcome goes out or an invoice is
  // paid (stillReserving): in Planning, and in Scheduled up to the shoot, as
  // the owner's step reads it. Its step asks for the contract and retainer.
  const unbooked = [own("contract"), own("invoice", { dueAt: "2026-12-01" })];
  expect(stillReserving({ status: "planning", documents: unbooked }, false, TODAY)).toBe(true);
  expect(stillReserving({ status: "scheduled", eventDate: "2026-12-20", documents: unbooked }, false, TODAY)).toBe(true);
  expect(stillReserving({ status: "scheduled", eventDate: "2026-11-20", documents: unbooked }, false, TODAY)).toBe(false);
  expect(stillReserving({ status: "planning", eventDate: "2026-11-20", documents: unbooked }, false, TODAY)).toBe(true);
  expect(stillReserving({ status: "planning", documents: unbooked }, true, TODAY)).toBe(false);
  expect(
    stillReserving({ status: "planning", documents: [own("contract"), own("invoice", { paidAt: "2026-11-20" })] }, false, TODAY),
  ).toBe(false);
  expect(stillReserving({ status: "planning", documents: [own("invoice")] }, false, TODAY)).toBe(false);
  // Booked itself, and the stages after the shoot, aren't a detour.
  expect(stillReserving({ status: "booked", documents: unbooked }, false, TODAY)).toBe(false);
  expect(stillReserving({ status: "editing", documents: unbooked }, false, TODAY)).toBe(false);
  expect(step({ status: "planning", questionnaireSnapshot: "{}", documents: unbooked, reserving: true })?.title).toBe(
    "Sign your contract and pay the retainer",
  );
  expect(step({ status: "scheduled", eventDate: "2026-12-20", documents: unbooked, reserving: true })?.title).toBe(
    "Sign your contract and pay the retainer",
  );
  expect(step({ status: "planning", questionnaireSnapshot: "{}", documents: unbooked })?.title).toBe(
    "Book your timeline call",
  );
  // The tracker and the status stay at Reserving your date meanwhile.
  expect(stageLine({ status: "planning", reserving: true })).toMatch(/: Reserving your date$/);
  expect(shownStatus({ status: "planning", reserving: true })).toBe("booked");
  // A second photographer's tracker leaves out the sales steps.
  const shared = shootStage({
    status: "scheduled",
    statusHistory: [{ status: "new-inquiry" }, { status: "in-conversation" }, { status: "proposal-sent" }, { status: "booked" }],
    calls: { discovery: { heldAt: "2026-10-01" } },
    documents: [{ type: "proposal" }],
    reserving: true,
  });
  // Before the booking (or closed before it) there's no stage to show them,
  // and the badge says only whether it's still on.
  expect(shownLabel(shootStage({ status: "booked" }), "booked")).toBe("In progress");
  expect(shownLabel(shootStage({ status: "lost", statusHistory: [{ status: "booked" }] }), "lost")).toBe("Closed");
  expect(shootStage({ status: "proposal-sent" }).status).toBeUndefined();
  expect(shootStage({ status: "booked", statusHistory: [{ status: "booked" }] }).status).toBeUndefined();
  expect(shootStage({ status: "lost", statusHistory: [{ status: "booked" }, { status: "lost" }] }).status).toBeUndefined();
  expect(
    stageLine(shootStage({ status: "archived", statusHistory: [{ status: "booked" }, { status: "planning" }, { status: "archived" }] })),
  ).toBe("Closed at Planning");
  expect(stagesFor(shared).stages.map((s) => s.key)).not.toContain("call");
  expect(stagesFor(shared).stages.map((s) => s.key)).not.toContain("proposal");
  expect(shared.reserving).toBeUndefined();

  // A shoot already past: what comes after it, whatever the planning left.
  expect(step({ status: "planning", eventDate: "2026-11-20", questionnaireSnapshot: "{}" })?.title).toBe(
    "I'm editing your photos",
  );
  expect(step({ status: "contract-signed", eventDate: "2026-11-20" })?.title).toBe("I'm editing your photos");
  // The status and tracker say so too (shootPassed), once nothing is being
  // reserved.
  expect(shootPassed({ status: "planning", eventDate: "2026-11-20" }, TODAY)).toBe(true);
  expect(shootPassed({ status: "scheduled", eventDate: "2026-11-25" }, TODAY)).toBe(false);
  expect(shootPassed({ status: "editing", eventDate: "2026-11-20" }, TODAY)).toBe(false);
  expect(shootPassed({ status: "planning", eventDate: "June 6-7, 2027" }, TODAY)).toBe(false);
  expect(shownStatus({ status: "planning", shot: true })).toBe("shot");
  expect(stageLine({ status: "planning", shot: true })).toMatch(/: Editing$/);
  // A date still being reserved reads first for the client; a second
  // photographer goes by the shoot date alone.
  expect(shownStatus({ status: "planning", reserving: true, shot: true })).toBe("booked");
  expect(stageLine(shootStage({ status: "planning", reserving: true, shot: true }))).toMatch(/: Editing$/);

  // The shoot, said by how soon it is.
  expect(step({ status: "scheduled", eventDate: "2026-11-25" })?.title).toBe("Your shoot is today");
  expect(step({ status: "scheduled", eventDate: "2026-11-26" })?.title).toBe("Your shoot is tomorrow");
  expect(step({ status: "scheduled", eventDate: "2026-11-28" })?.title).toBe("Your shoot is on Saturday");
  expect(step({ status: "scheduled", eventDate: "2026-12-20", documents: [own("timeline")] })).toMatchObject({
    title: "Your shoot is on December 20, 2026",
    detail: "Write to me here with anything that changes.",
    action: { label: "View your timeline" },
  });
  // A date the site can't read as one day still gets the timeline.
  expect(step({ status: "scheduled", eventDate: "June 6-7, 2027", documents: [own("timeline")] })).toMatchObject({
    title: "Your shoot is on the calendar",
    action: { label: "View your timeline" },
  });
  // The plan is pointed to only when there is one.
  expect(step({ status: "scheduled", eventDate: "2026-12-20", planSummary: "Ceremony at four." })?.detail).toBe(
    "Your plan is below. Write to me here with anything that changes.",
  );

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
  // More than one invoice open says how many.
  expect(
    step({ status: "delivered", documents: [own("gallery"), own("invoice"), own("invoice", { dueAt: "2026-12-10" })] })?.detail,
  ).toBe("There are 2 invoices still open.");
  // Delivered with no gallery link on the project: it's in their email.
  expect(step({ status: "delivered" }, ctx({ galleryLoginUrl: "https://gallery.example.com/client" }))).toMatchObject({
    title: "Your gallery is ready",
    detail: "The link is in your email.",
    action: { label: "Sign in to your galleries", href: "https://gallery.example.com/client" },
  });
  expect(step({ status: "delivered", documents: [own("invoice")] }, ctx({ paymentLine: "Pay by Zelle." }))).toMatchObject({
    detail: "The link is in your email. There's one invoice still open. Pay by Zelle.",
    secondary: { label: "Pay the invoice" },
  });
  // Complete keeps the way back to the photos.
  expect(step({ status: "complete" }, ctx({ galleryLoginUrl: "https://gallery.example.com/client" }))?.secondary).toEqual({
    label: "Sign in to your galleries",
    href: "https://gallery.example.com/client",
    external: true,
  });
  // An overdue balance says so.
  expect(step({ status: "delivered", documents: [own("gallery"), own("invoice", { dueAt: "2026-11-10" })] })?.detail).toBe(
    "There's one invoice still open. It was due November 10, 2026.",
  );
  // A call to book reads right for someone who already booked it.
  expect(step({ status: "new-inquiry" })?.detail).toMatch(/Already booked\? I'll see you then\.$/);
  expect(step({ status: "complete", documents: [own("gallery")] })).toMatchObject({
    title: "Leave a review",
    action: { href: "https://reviews.example.com/julian" },
    secondary: { label: "View your gallery" },
  });
  // A closed project has no step.
  expect(step({ status: "lost" })).toBeUndefined();
});

test("sign-in returns only to the projects list or a project page", () => {
  expect(portalReturnPath("/portal/projects/0f0e3c1a-1111-4222-8333-444455556666")).toBe(
    "/portal/projects/0f0e3c1a-1111-4222-8333-444455556666",
  );
  expect(portalReturnPath("/portal/dashboard")).toBe("/portal/dashboard");
  for (const bad of [
    "https://evil.example/portal/x",
    "//evil.example",
    "/portal/../admin",
    "/admin/projects",
    "/portal/x?y=1",
    "/portal",
    // Routes under /portal that aren't pages to land on.
    "/portal/logout",
    "/portal/verify",
    "/portal/projects/not-an-id",
    "/PORTAL/dashboard",
    undefined,
  ]) {
    expect(portalReturnPath(bad), String(bad)).toBeUndefined();
  }
});

// A fresh wedding project for one test, with the address its client signs in
// with. The wedding is months out, so its steps read as before the shoot
// whenever the suite runs.
async function newProject(adminRequest: APIRequestContext, tag: string) {
  const email = `e2e-path-${tag}-${Date.now()}@example.com`;
  const eventDate = shiftDay(studioToday(), { months: 7 });
  const res = await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Path", serviceType: "weddings", eventDate, force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return { id: id as string, email, eventDate };
}
const sentTo = (calls: FakeCall[], to: string) =>
  calls.filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(to));

test("the project page: the next step, the tracker, links by kind, and the plan once proposed", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "page");
  await patchProject(p.id, {
    plan_summary: "Getting ready at the inn, then the garden ceremony.",
    secondary_dates: [{ label: "Rehearsal dinner", date: "2027-06-11" }],
    locations: [{ label: "Stone Barn", address: "1 Farm Rd, Leesburg" }],
  });
  const page = await portalPage(p.email);
  await page.goto(`/portal/projects/${p.id}`);
  const next = page.getByRole("region", { name: "Your next step" });
  await expect(next.getByRole("heading", { name: "Book a discovery call" })).toBeVisible();
  await expect(page.getByText(/^Step 1 of 10: Inquiry$/)).toBeVisible();
  // Before a proposal, no plan, but the facts, other dates and places are there.
  await expect(page.getByText("Getting ready at the inn")).toHaveCount(0);
  const glance = page.getByRole("region", { name: "At a glance" });
  await expect(glance).toContainText("Rehearsal dinner: June 11, 2027");
  await expect(glance).toContainText("Stone Barn");
  // The questionnaire is there to fill in before the shoot.
  const questionnaire = page.getByRole("heading", { name: "Your planning questionnaire" });
  await expect(questionnaire).toBeVisible();

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
  await expect(page.getByRole("region", { name: "Your plan" })).toContainText("Date held until");
  // Links grouped by kind, each under its own heading.
  await expect(page.getByRole("heading", { name: "Proposal", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
  expect(scan.violations).toEqual([]);

  // They said yes: with Julian's contract on, the date is being reserved, and
  // the hold has done its job.
  await patchProject(p.id, {
    documents: [
      { id: "pr", type: "proposal", label: "Your proposal", url: "https://links.example.com/proposal", uploadedBy: "julian" },
      { id: "c", type: "contract", label: "Contract", url: "https://links.example.com/contract", uploadedBy: "julian" },
    ],
  });
  await page.reload();
  await expect(next).toContainText("Sign your contract");
  await expect(page.getByText(CLIENT_STATUS_CLIENT_LABEL.booked, { exact: true })).toBeVisible();
  await expect(page.getByText("Date held until")).toHaveCount(0);

  // Booked, and the shoot came and went with nothing moving it on: the page
  // reads as after the shoot, status and tracker included.
  await patchProject(p.id, { status: "contract-signed", event_date: shiftDay(studioToday(), { days: -3 }) });
  await page.reload();
  await expect(next).toContainText("I'm editing your photos");
  await expect(page.getByText(CLIENT_STATUS_CLIENT_LABEL.shot, { exact: true })).toBeVisible();
  await expect(page.getByText(/^Step \d+ of \d+: Editing$/)).toBeVisible();
  // Nothing left to prepare: no questionnaire prompt.
  await expect(questionnaire).toHaveCount(0);
});

test("sign-in returns to the page the client was sent from, and one project opens straight away", async ({
  adminRequest,
  page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  // Two projects, so a sign-in that lost the page would land on their list.
  const p = await newProject(adminRequest, "return");
  const other = await adminRequest.post("/api/admin/create-project", {
    data: { email: p.email, clientName: "E2E Path", serviceType: "engagements", force: true },
  });
  expect(other.status()).toBe(200);

  // Sent to sign in from the project page; the link brings them back to it.
  await page.goto(`/portal/projects/${p.id}`);
  await expect(page).toHaveURL(/\/portal\?from=/);
  await page.getByLabel("Email").fill(p.email);
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/sign-in link is on its way/)).toBeVisible();
  await page.goto(await magicLinkFor(p.email));
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${p.id}$`));

  // Each request comes from its own address, so a rerun on a server still up
  // stays under the sign-in limit. The reply is the same whether or not a
  // link went out, so each step waits for a new email rather than reusing
  // the last link.
  let n = 0;
  const signInAs = async (email: string, data: Record<string, string> = {}) => {
    n += 1;
    await page.context().clearCookies();
    const before = sentTo(await fakes.calls("resend"), email).length;
    const res = await page.request.post("/api/portal/request-link", {
      data: { email, hp_company: "", ...data },
      headers: { "x-forwarded-for": `10.250.${Math.floor(Math.random() * 250)}.${n}` },
    });
    expect(res.status()).toBe(200);
    await expect.poll(async () => sentTo(await fakes.calls("resend"), email).length, { message: "a new sign-in link" }).toBe(
      before + 1,
    );
    await page.goto(await magicLinkFor(email));
  };

  // A link asked for with a project page opens it.
  await signInAs(p.email, { next: `/portal/projects/${p.id}` });
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${p.id}$`));

  // With no page asked for, their list.
  await signInAs(p.email);
  await expect(page).toHaveURL(/\/portal\/dashboard$/);
  // Each project is a card with its status and its stage.
  const card = page.locator(`a[href="/portal/projects/${p.id}"]`);
  await expect(card).toContainText(CLIENT_STATUS_CLIENT_LABEL["new-inquiry"]);
  await expect(card.getByRole("img", { name: "Step 1 of 10: Inquiry" })).toBeVisible();

  // A page that isn't one of the portal's is ignored.
  await signInAs(p.email, { next: "https://evil.example/portal/x" });
  await expect(page).toHaveURL(/\/portal\/dashboard$/);

  // Someone with one project lands on it.
  const single = await newProject(adminRequest, "single");
  await signInAs(single.email);
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${single.id}$`));
});

test("a second photographer's invite opens the project, with a call sheet, not the client's next step or thread", async ({
  adminRequest,
  page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "sheet");
  await patchProject(p.id, {
    status: "scheduled",
    status_history: [{ status: "new-inquiry" }, { status: "in-conversation" }, { status: "proposal-sent" }, { status: "booked" }],
    calls: { discovery: { heldAt: "2026-10-01T15:00:00.000Z" } },
    partner_name: "Sam",
    guest_count: 1,
    locations: [{ label: "Stone Barn", address: "1 Farm Rd, Leesburg" }],
    documents: [
      { id: "tl", type: "timeline", label: "Day-of timeline", url: "https://links.example.com/timeline", uploadedBy: "julian" },
      { id: "pr", type: "proposal", label: "Proposal", url: "https://links.example.com/proposal", uploadedBy: "julian" },
      { id: "dr", type: "timeline", label: "Our draft timeline", url: "https://links.example.com/draft", uploadedBy: "client" },
    ],
  });
  const second = `e2e-path-shooter-${Date.now()}@example.com`;
  // Shared on another project too, so an invite that lost its page would land
  // on their list.
  const earlier = await newProject(adminRequest, "sheet-other");
  const shareEarlier = await adminRequest.post("/api/admin/collaborators", {
    data: { action: "add", projectId: earlier.id, email: second, sendInvite: false },
  });
  expect(shareEarlier.status()).toBe(200);
  const grant = await adminRequest.post("/api/admin/collaborators", {
    data: { action: "add", projectId: p.id, email: second, sendInvite: true },
  });
  expect(grant.status()).toBe(200);

  // The invite's sign-in link opens the shared project.
  await page.goto(await magicLinkFor(second));
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${p.id}$`));
  const sheet = page.getByRole("region", { name: "Call sheet" });
  await expect(sheet).toContainText(formatHumanDate(p.eventDate));
  await expect(sheet).toContainText("E2E Path and Sam, 1 guest");
  await expect(sheet).toContainText("Stone Barn");
  await expect(sheet).toContainText("Day-of contact");
  await expect(sheet.getByRole("link", { name: "Day-of timeline" })).toHaveAttribute("href", "https://links.example.com/timeline");
  await expect(page.getByRole("region", { name: "Your next step" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Messages" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Planning details" })).toBeVisible();
  // The client's draft is their file, not the day's timeline.
  await expect(sheet).not.toContainText("Our draft timeline");
  await expect(page.getByRole("link", { name: "Our draft timeline" })).toBeVisible();
  // Their tracker leaves out the sales steps (the call, the proposal), here
  // and on their dashboard card.
  await expect(page.getByText(/^Step 5 of 8: Shoot$/)).toBeVisible();
  await page.goto("/portal/dashboard");
  await expect(
    page.locator(`a[href="/portal/projects/${p.id}"]`).getByRole("img", { name: "Step 5 of 8: Shoot" }),
  ).toBeVisible();

  // Before the booking is done, nothing tells them how it stands.
  await patchProject(p.id, { status: "booked" });
  await page.goto(`/portal/projects/${p.id}`);
  await expect(page.getByRole("region", { name: "Call sheet" })).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Reserving your date")).toHaveCount(0);
  await expect(page.getByText(/^Step \d+ of \d+:/)).toHaveCount(0);
  // Their dashboard card too.
  await page.goto("/portal/dashboard");
  const card = page.locator(`a[href="/portal/projects/${p.id}"]`);
  await expect(card).toContainText("In progress");
  await expect(card.getByRole("img")).toHaveCount(0);
  // Closed before the booking, it says so.
  await patchProject(p.id, { status: "lost" });
  await page.reload();
  await expect(card).toContainText("Closed");
});

test("a booking the questionnaire moved past stays at Reserving your date until the welcome goes out", async ({
  adminRequest,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "reserving");
  await patchProject(p.id, {
    status: "planning",
    status_history: [{ status: "new-inquiry" }, { status: "booked" }, { status: "planning" }],
    documents: [
      { id: "c", type: "contract", label: "Contract", url: "https://links.example.com/contract", uploadedBy: "julian" },
      { id: "i", type: "invoice", label: "Retainer", url: "https://links.example.com/retainer", uploadedBy: "julian" },
    ],
  });
  const page = await portalPage(p.email);
  await page.goto(`/portal/projects/${p.id}`);
  const next = page.getByRole("region", { name: "Your next step" });
  await expect(next).toContainText("Sign your contract and pay the retainer");
  await expect(page.getByText(/^Step \d+ of \d+: Reserving your date$/)).toBeVisible();
  await expect(page.getByText(CLIENT_STATUS_CLIENT_LABEL.booked, { exact: true })).toBeVisible();
  // Their dashboard card reads the same.
  await page.goto("/portal/dashboard");
  const card = page.locator(`a[href="/portal/projects/${p.id}"]`);
  await expect(card).toContainText(CLIENT_STATUS_CLIENT_LABEL.booked);
  await expect(card.getByRole("img", { name: /: Reserving your date$/ })).toBeVisible();
  await page.goto(`/portal/projects/${p.id}`);

  // The retainer came in another way and the welcome went out: booked.
  const welcome = await adminRequest.post("/api/admin/send-email", {
    data: { projectId: p.id, templateId: "booking-welcome", subject: "You're booked", body: "Hi,\n\nYou're booked.\n\nJulian" },
  });
  expect(welcome.status()).toBe(200);
  await page.reload();
  await expect(next).toContainText("Fill in your planning questionnaire");
  await expect(page.getByText(/^Step \d+ of \d+: Planning$/)).toBeVisible();
  await expect(page.getByText(CLIENT_STATUS_CLIENT_LABEL.planning, { exact: true })).toBeVisible();
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
  // The questionnaire saves to the project and emails the client, so its
  // link isn't offered here, in the next step or the callout.
  await patchProject(p.id, { status: "planning" });
  await adminPage.reload();
  const next = adminPage.getByRole("region", { name: "Your next step" });
  await expect(next).toContainText("Fill in your planning questionnaire");
  await expect(next.getByRole("link")).toHaveCount(0);
  await expect(adminPage.locator('a[href^="/questionnaire/"]')).toHaveCount(0);

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

  const edited = await client.post("/api/portal/update", { data: { projectId: p.id, phone: "(703) 555-0100" } });
  expect(edited.status()).toBe(200);
  const editAlert = sentTo(await fakes.calls("resend"), OWNER).at(-1);
  expect(editAlert?.body?.subject).toBe(`Client updated their details: ${p.email}`);
  expect(String(editAlert?.body?.text)).toContain(`/admin/projects/${p.id}?tab=details`);
});

test("the questionnaire's thank-you page leads back to the project it was opened for", async ({ page }) => {
  const project = "0f0e3c1a-1111-4222-8333-444455556666";
  // The answers aren't the point here, so the send is answered in the browser.
  await page.route("**/api/questionnaire", (route) => route.fulfill({ json: { ok: true } }));
  const params = new URLSearchParams({
    project,
    fullName: "E2E Path",
    email: "e2e-path-thanks@example.com",
    phone: "(703) 555-7777",
    bookingStatus: "I'm already booked, let's plan",
    package: "Still deciding",
  });
  await page.goto(`/questionnaire/maternity?${params.toString()}`);
  await advanceToLastSection(page);
  await satisfyVisible(page);
  await page.getByRole("button", { name: "Submit questionnaire" }).click();
  await expect(page.getByRole("link", { name: /Back to your project/ })).toHaveAttribute(
    "href",
    `/portal/projects/${project}`,
  );
});
