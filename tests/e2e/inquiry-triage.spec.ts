import { test, expect, hasTestStore, magicLinkFor, type FakeCall } from "./support/fixtures";

// Every new inquiry is assessed by AI before the owner email goes out: the email
// opens with the verdict and summary, links to the project's Compose panel to
// draft the reply (triage writes none itself), and the owner gets a text for a
// lead worth an interruption. The assessment is saved on the project, so its
// page shows it without asking the AI again, and the draft link carries no
// client detail. The fake provider is scripted with the model's answer; an
// unusable answer leaves the inquiry unaffected.

const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts
const OWNER_PHONE = "+15555550199"; // INQUIRY_SMS_TO in playwright.config.ts

const ownerEmail = async (fakes: { calls: (p: "resend") => Promise<FakeCall[]> }) =>
  (await fakes.calls("resend")).filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(OWNER)).at(-1);
const ownerTexts = async (fakes: { calls: (p: "twilio") => Promise<FakeCall[]> }) =>
  (await fakes.calls("twilio")).filter((c) => c.body?.To === OWNER_PHONE);

const assessment = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    summary: "A fall wedding at a Leesburg vineyard for about 120 guests.",
    fit: "good",
    fitReason: "Weddings are the core service and the budget fits.",
    urgency: "high",
    urgencyReason: "The date is eight months out and they want to book soon.",
    keyDetails: ["Date: 2027-10-09", "About 120 guests"],
    ...over,
  });

const inquiry = (email: string) => ({
  name: "Riley Example",
  email,
  service: "weddings",
  eventDate: "2027-10-09",
  message: "We're planning a vineyard wedding in Leesburg and would love to book you.",
});

test("the owner email opens with the assessment and drafts no reply", async ({ request, fakes }) => {
  await fakes.script({ replies: [assessment()] });
  const res = await request.post("/api/inquire", { data: inquiry(`e2e-triage-${Date.now()}@example.com`) });
  expect(res.status()).toBe(200);

  const email = await ownerEmail(fakes);
  const text = String(email?.body?.text);
  expect(text).toContain("AI assessment: Good fit, high urgency");
  expect(text).toContain("A fall wedding at a Leesburg vineyard");
  expect(String(email?.body?.html)).toContain("AI assessment");
  expect(text).not.toMatch(/suggested reply/i);
});

test("the owner email links to Compose on the filed project, with no client detail in the link", async ({
  request,
  fakes,
  adminPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  await fakes.script({ replies: [assessment()] });
  // A forged Origin header must not change where the link points.
  const res = await request.post("/api/inquire", {
    headers: { origin: "https://evil.example" },
    data: inquiry(`e2e-triage-link-${Date.now()}@example.com`),
  });
  expect(res.status()).toBe(200);

  const text = String((await ownerEmail(fakes))?.body?.text);
  const link = text.match(/Draft a reply: (\S+)/)?.[1] ?? "";
  const url = new URL(link);
  expect(url.origin).toBe("http://localhost:3100");
  expect(url.pathname).toMatch(/^\/admin\/projects\/[0-9a-f-]{36}$/);
  expect([...url.searchParams.keys()]).toEqual(["compose"]);
  expect(url.searchParams.get("compose")).toBe("inquiry-reply");
  expect(url.hash).toBe("#compose");

  // The project page shows the saved assessment, and opening the link steers
  // the reply from it, without another call to the AI.
  const before = (await fakes.calls("ai")).length;
  await adminPage.goto(url.pathname + url.search + url.hash);
  await expect(adminPage.getByText("Good fit", { exact: true })).toBeVisible();
  await expect(adminPage.getByText("A fall wedding at a Leesburg vineyard for about 120 guests.")).toBeVisible();
  await expect(adminPage.getByLabel("Extra instructions for the AI draft")).toHaveValue(/Leesburg vineyard/);
  expect((await fakes.calls("ai")).length).toBe(before);
});

test("a good lead texts the owner; a poor, unhurried one doesn't", async ({ request, fakes }) => {
  await fakes.script({ replies: [assessment()] });
  await request.post("/api/inquire", { data: inquiry(`e2e-triage-good-${Date.now()}@example.com`) });
  const [text] = await ownerTexts(fakes);
  expect(String(text?.body?.Body)).toContain("New inquiry: Riley Example");
  expect(String(text?.body?.Body)).toContain("(Good fit, high urgency)");
  expect(String(text?.body?.Body).length).toBeLessThanOrEqual(320);

  await fakes.script({ replies: [assessment({ fit: "poor", urgency: "low" })] });
  await request.post("/api/inquire", { data: inquiry(`e2e-triage-poor-${Date.now()}@example.com`) });
  expect(await ownerTexts(fakes)).toHaveLength(1);
});

test("an unusable assessment leaves the inquiry as it was, and still texts the owner", async ({
  request,
  fakes,
}) => {
  // The fake's default reply isn't triage JSON.
  const res = await request.post("/api/inquire", { data: inquiry(`e2e-triage-bad-${Date.now()}@example.com`) });
  expect(res.status()).toBe(200);
  const text = String((await ownerEmail(fakes))?.body?.text);
  expect(text).toContain("We're planning a vineyard wedding");
  expect(text).not.toContain("AI assessment");
  // With no assessment nothing rules the lead out.
  expect(await ownerTexts(fakes)).toHaveLength(1);
});

test("a sign-in link ignores a forged Origin header", async ({ adminRequest, request }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-origin-${Date.now()}@example.com`;
  await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Origin", serviceType: "weddings", force: true },
  });
  const res = await request.post("/api/portal/request-link", {
    headers: { origin: "https://evil.example" },
    data: { email, hp_company: "" },
  });
  expect(res.status()).toBe(200);
  expect(new URL(await magicLinkFor(email)).origin).toBe("http://localhost:3100");
});
