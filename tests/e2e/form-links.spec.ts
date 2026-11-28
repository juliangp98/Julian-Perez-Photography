import { createHmac } from "node:crypto";
import { test, expect, hasTestStore } from "./support/fixtures";
import { AUTH_SECRET } from "./support/auth-secret";
import { newProject, patchProject } from "./support/test-store";
import { siteSettingsFallback } from "../../src/lib/site-settings-data";

// A project's form links and the emails that carry them. The questionnaire
// link (and the inquiry link for a project with no service) names only the
// project and its key; the form reads the client's details on the server when
// the key matches, so their email and phone never ride in an address. Every
// email before the shoot asks for the questionnaire while it isn't back, how
// to pay shows only while an invoice is open, and the planning call is the
// one for the service.

const key = (id: string) => createHmac("sha256", AUTH_SECRET).update(`form:${id}`).digest("hex").slice(0, 16);

test.describe("form links against the test store", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  test("the questionnaire link names the project and its key, and opens with the client's details", async ({
    adminRequest,
    portalPage,
    page,
  }) => {
    const p = await newProject(adminRequest, `Form ${Date.now()}`);
    await patchProject(p.id, { phone: "(703) 555-0177" });
    const link = `/questionnaire/weddings?project=${p.id}&key=${key(p.id)}`;

    // The portal's button carries only that.
    const client = await portalPage(p.email);
    await client.goto(`/portal/projects/${p.id}`);
    const button = client.locator(`a[href^="/questionnaire/weddings?project="]`).first();
    await expect(button).toHaveAttribute("href", link);

    await page.goto(link);
    await expect(page.getByLabel("Your full name")).toHaveValue(p.name);
    await expect(page.getByLabel("Email address")).toHaveValue(p.email);
    await expect(page.getByLabel("Phone number")).toHaveValue("(703) 555-0177");

    // A wrong key opens the form empty, whatever its characters.
    await page.goto(`/questionnaire/weddings?project=${p.id}&key=0000000000000000`);
    await expect(page.getByLabel("Email address")).toHaveValue("");
    const odd = await page.goto(`/questionnaire/weddings?project=${p.id}&key=${encodeURIComponent("é".repeat(16))}`);
    expect(odd?.status()).toBe(200);
    await expect(page.getByLabel("Email address")).toHaveValue("");
    // An older link's own fields still prefill.
    await page.goto(`/questionnaire/weddings?project=${p.id}&fullName=Older+Link`);
    await expect(page.getByLabel("Your full name")).toHaveValue("Older Link");
  });

  test("a project with no service gets an inquiry link the same way", async ({ adminRequest, portalPage, page }) => {
    const email = `e2e-form-inq-${Date.now()}@example.com`;
    const created = await adminRequest.post("/api/admin/create-project", {
      data: { email, clientName: "E2E No Service", force: true },
    });
    const { id } = await created.json();
    const client = await portalPage(email);
    await client.goto(`/portal/projects/${id}`);
    const link = client.getByRole("link", { name: "Tell me what you're thinking →" });
    await expect(link).toHaveAttribute("href", `/inquire?project=${id}&key=${key(id)}`);
    await page.goto(`/inquire?project=${id}&key=${key(id)}`);
    await expect(page.getByLabel(/^Email/).first()).toHaveValue(email);
  });

  test("every email before the shoot asks for the questionnaire while it isn't back", async ({
    adminRequest,
    adminPage: page,
  }) => {
    const p = await newProject(adminRequest, `Nudge ${Date.now()}`);
    const body = page.getByLabel("Email body");
    await page.goto(`/admin/projects/${p.id}?compose=discovery-recap#compose`);
    await expect(body).toHaveValue(/the planning questionnaire helps me prepare, and it's already filled in with what I have: /);
    await expect(body).toHaveValue(new RegExp(`/questionnaire/weddings\\?project=${p.id}&key=${key(p.id)}`));
    // No address in it.
    await expect(body).not.toHaveValue(new RegExp(encodeURIComponent(p.email)));

    // Back: the line is left out, with its blank line. (The same address with
    // its #compose is a same-page jump, so the page is reloaded.)
    await patchProject(p.id, { questionnaire_snapshot: JSON.stringify({ fullName: p.name }) });
    await page.reload();
    await expect(body).not.toHaveValue(/planning questionnaire helps me prepare/);
    await expect(body).not.toHaveValue(/\n\n\n/);

    // A service with no questionnaire never asks.
    const pet = await newProject(adminRequest, `Pet ${Date.now()}`, "pet");
    await page.goto(`/admin/projects/${pet.id}?compose=inquiry-reply#compose`);
    await expect(body).not.toHaveValue(/planning questionnaire/);
  });

  test("how to pay shows only while an invoice is open, and the planning call fits the service", async ({
    adminRequest,
    adminPage: page,
  }) => {
    const p = await newProject(adminRequest, `Pay ${Date.now()}`);
    await patchProject(p.id, { payment_method: "zelle", status: "booked" });
    const body = page.getByLabel("Email body");
    const zelle = siteSettingsFallback.paymentInstructions.zelle;
    await page.goto(`/admin/projects/${p.id}?compose=contract-deposit#compose`);
    await expect(body).not.toHaveValue(new RegExp(zelle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await patchProject(p.id, {
      documents: [{ id: "inv-1", type: "invoice", label: "Retainer", url: "https://pay.example.com/r", addedAt: new Date().toISOString() }],
    });
    await page.reload();
    await expect(body).toHaveValue(new RegExp(zelle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    // The timeline call for a wedding, the planning call for a newborn session.
    await page.goto(`/admin/projects/${p.id}?compose=planning-kickoff#compose`);
    await expect(body).toHaveValue(new RegExp(siteSettingsFallback.calls.weddingTimelineCall.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const newborn = await newProject(adminRequest, `Newborn ${Date.now()}`, "newborn");
    await page.goto(`/admin/projects/${newborn.id}?compose=planning-kickoff#compose`);
    await expect(body).toHaveValue(new RegExp(siteSettingsFallback.calls.planningCall.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("Compose and the send route refuse anything left in brackets", async ({ adminRequest, adminPage: page, fakes }) => {
    const p = await newProject(adminRequest, `Brackets ${Date.now()}`);
    const res = await adminRequest.post("/api/admin/send-email", {
      data: { projectId: p.id, subject: "Hello", body: "Hi [firstName], see [the gallery](https://x.example.com)." },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe("Fill these in first: [firstName], [the gallery].");
    expect((await fakes.calls("resend")).filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(p.email))).toEqual([]);

    await page.goto(`/admin/projects/${p.id}?compose=inquiry-reply#compose`);
    await page.getByRole("button", { name: "Send to client" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Fill these in first: [A line or two answering something specific they shared.]." })).toBeVisible();
  });
});
