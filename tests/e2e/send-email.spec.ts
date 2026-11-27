import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject, readProject } from "./support/test-store";
import { formatHumanDate, shiftDay, studioToday } from "../../src/lib/field-format";

// Owner-composed pipeline emails (/api/admin/send-email). The owner picks a
// stage template on a project, it prefills, they edit, then send. The recipient
// is resolved server-side from the project id (never trusted from the body).
// Once it has gone, the template moves the project on: its status, its next
// follow-up and the date hold (the rules themselves are in send-effects.spec.ts).
//
// Real sends, retries and failures are in email-send.spec.ts.

test("send-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/send-email", {
    headers: { "x-forwarded-for": "10.99.8.1" },
    data: { projectId: "p1", subject: "Hello", body: "Hi there." },
  });
  expect(res.status()).toBe(401);
});

test("send-email: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing subject and body — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/send-email", {
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(400);
});

test("send-email: rejects a template it doesn't know", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/send-email", {
    data: { projectId: "p1", templateId: "hold-the-date", subject: "Hello", body: "Hi there." },
  });
  expect(res.status()).toBe(400);
});

// A fresh wedding project for one test.
async function newProject(request: APIRequestContext, tag: string) {
  const email = `e2e-send-${tag}-${Date.now()}@example.com`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Send", serviceType: "weddings", eventDate: "2027-06-12", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return { id: id as string, email };
}

const send = (request: APIRequestContext, projectId: string, templateId: string) =>
  request.post("/api/admin/send-email", {
    data: { projectId, templateId, subject: "About your wedding", body: "Hi,\n\nA note.\n\nJulian" },
  });

test("send-email: an inquiry reply moves the project on and sets a follow-up", async ({
  adminRequest: request,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(request, "reply");
  const res = await send(request, p.id, "inquiry-reply");
  expect(res.status()).toBe(200);
  const json = await res.json();
  const followUp = shiftDay(studioToday(), { days: 3 });
  expect(json).toMatchObject({
    sent: true,
    moved: { status: "responded", followUpAt: followUp, followUpNote: "Follow up on the inquiry reply" },
  });

  // Sending it again changes nothing that already moved; a recap after the
  // call moves the project to Proposal sent.
  expect((await (await send(request, p.id, "inquiry-reply")).json()).moved.status).toBeUndefined();
  const recap = await (await send(request, p.id, "discovery-recap")).json();
  expect(recap.moved.status).toBe("proposal-sent");
  // The built-in services carry no hold days, so no hold starts.
  expect(recap.moved.holdUntil).toBeUndefined();

  await page.goto(`/admin/projects/${p.id}`);
  await expect(page.locator("#project-status")).toHaveValue("proposal-sent");
  await expect(page.getByText(`${formatHumanDate(shiftDay(studioToday(), { days: 6 }))}: Follow up on the proposal`)).toBeVisible();
});

test("send-email: a 'not available' email archives the project and clears its follow-up and hold", async ({
  adminRequest: request,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(request, "close");
  await send(request, p.id, "inquiry-reply");
  await patchProject(p.id, { hold_until: shiftDay(studioToday(), { days: 5 }) });

  const json = await (await send(request, p.id, "not-available")).json();
  expect(json.moved).toEqual({ status: "archived" });

  await page.goto(`/admin/projects/${p.id}`);
  await expect(page.locator("#project-status")).toHaveValue("archived");
  await expect(page.getByText("None set.")).toBeVisible();
  await expect(page.getByText("No hold running")).toBeVisible();
  // Cleared in the store, not only hidden while closed.
  expect(await readProject(p.id, "hold_until, follow_up_at")).toEqual({ hold_until: null, follow_up_at: null });
});

test("send-email: the contract and retainer tell the client their date is being reserved", async ({
  adminRequest: request,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(request, "reserve");
  await patchProject(p.id, { status: "proposal-sent", hold_until: shiftDay(studioToday(), { days: 4 }) });
  expect((await (await send(request, p.id, "contract-deposit")).json()).moved.status).toBe("booked");

  const client = await portalPage(p.email);
  await client.goto(`/portal/projects/${p.id}`);
  await expect(client.getByText("Reserving your date", { exact: true })).toBeVisible();
  const next = client.getByRole("region", { name: "Your next step" });
  // Before the Square links are on the project, the client is told they're coming.
  await expect(next).toContainText("Your contract is on its way");
  await patchProject(p.id, {
    documents: [
      { id: "c", type: "contract", label: "Contract", url: "https://links.example.com/contract", uploadedBy: "julian" },
      { id: "i", type: "invoice", label: "Retainer", url: "https://links.example.com/retainer", uploadedBy: "julian" },
    ],
  });
  await client.reload();
  await expect(next).toContainText("Sign your contract and pay the retainer");
  await expect(next.getByRole("link", { name: "Pay the retainer" })).toHaveAttribute(
    "href",
    "https://links.example.com/retainer",
  );
  // The hold has done its job once the date is being reserved.
  await expect(client.getByText("Date held until")).toHaveCount(0);
});

test("status: closing a project by hand clears its follow-up and hold", async ({
  adminRequest: request,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(request, "lost");
  await send(request, p.id, "inquiry-reply");
  await patchProject(p.id, { hold_until: shiftDay(studioToday(), { days: 4 }) });
  const res = await request.post("/api/admin/update", {
    data: { id: p.id, fields: { status: "lost" } },
  });
  expect(res.status()).toBe(200);

  await page.goto(`/admin/projects/${p.id}`);
  await expect(page.locator("#project-status")).toHaveValue("lost");
  await expect(page.getByText("None set.")).toBeVisible();
  await expect(page.getByText("No hold running")).toBeVisible();
  // Cleared in the store, not only hidden while closed.
  expect(await readProject(p.id, "hold_until, follow_up_at")).toEqual({ hold_until: null, follow_up_at: null });
});

test("compose: a proposal shows what sending does, names the running hold, and confirms what moved", async ({
  adminRequest: request,
  adminPage: page,
  portalPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(request, "compose");
  const hold = shiftDay(studioToday(), { days: 9 });
  await patchProject(p.id, { status: "in-conversation", hold_until: hold, package: "Silver" });
  await request.post("/api/admin/update", {
    data: { id: p.id, addDocument: { type: "proposal", label: "Proposal", url: "https://links.example.com/proposal" } },
  });

  await page.goto(`/admin/projects/${p.id}?compose=discovery-recap#compose`);
  const body = page.getByLabel("Email body");
  await expect(body).toHaveValue(/Here's the full proposal: https:\/\/links\.example\.com\/proposal/);
  await expect(body).toHaveValue(new RegExp(`holding it for you until ${formatHumanDate(hold)}`));
  // The package the project is on, with what it includes, from the service.
  await expect(body).toHaveValue(/I'd recommend Silver \(\$[\d,]+\):\n- /);
  // What sending does to this project: the hold is already running, so none starts.
  await expect(
    page.getByText(
      `Sending this moves the project to Proposal sent and sets a follow-up for ${formatHumanDate(shiftDay(studioToday(), { days: 6 }))}.`,
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Send to client" }).click();
  const confirmation = page.getByRole("status").filter({ hasText: "Sent to the client." });
  await expect(confirmation).toContainText("Now Proposal sent.");
  await expect(confirmation).toContainText(
    `Follow-up on ${formatHumanDate(shiftDay(studioToday(), { days: 6 }))}: Follow up on the proposal.`,
  );
  // The running hold is kept, and the client sees it.
  await expect(confirmation).not.toContainText("Date held until");
  const client = await portalPage(p.email);
  await client.goto(`/portal/projects/${p.id}`);
  await expect(client.getByText("Date held until")).toBeVisible();
  await expect(client.getByText(formatHumanDate(hold), { exact: true })).toBeVisible();
});
