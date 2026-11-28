import { createHmac, randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { AUTH_SECRET } from "./support/auth-secret";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";
import { addMessage, newProject, patchProject, testStore } from "./support/test-store";
import { neutraliseLinks } from "../../src/lib/linkify";
import { missingColumn } from "../../src/lib/missing-column";
import { parseDraft } from "../../src/lib/ai/draft-reply";
import { portfolioLines, turnaroundLine } from "../../src/lib/services-data";
import { SITE_URL, siteSettingsFallback } from "../../src/lib/site-settings-data";

// AI email drafting (/api/admin/draft-email). On a project the owner asks for
// a draft from a pipeline template, or with none, a reply in the
// conversation; the route returns it for him to review (it never sends). The
// draft reads the whole project at the client tier: the facts and links, the
// client's side of the discovery call with his action items as guidance, the
// questionnaire or its link, the conversation as the client sees it, an open
// invoice, and the portfolio. These specs read what the stand-in AI provider
// was sent.
//
// No project has the id "p1", so a well-formed signed-in request is accepted
// but no-ops (`drafted: false`) without calling a provider.

// The user prompt of each chat request made since `since` calls.
const promptsSince = async (fakes: { calls: (p: "ai") => Promise<FakeCall[]> }, since: number) =>
  (await fakes.calls("ai"))
    .slice(since)
    .filter((c) => c.path === "/chat/completions")
    .map((c) => {
      const messages = (c.body?.messages ?? []) as { role: string; content: string }[];
      return messages.find((m) => m.role === "user")?.content ?? "";
    });

const draft = (request: APIRequestContext, data: Record<string, unknown>) =>
  request.post("/api/admin/draft-email", { data });

const REPLY = "Subject: A note\n\nHi,\n\nThanks for the details.\n\nJulian";

test("draft-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-email", {
    headers: { "x-forwarded-for": "10.99.9.1" },
    data: { projectId: "p1", templateId: "gallery-delivery" },
  });
  expect(res.status()).toBe(401);
});

test("draft-email: a steer over 600 characters is refused when signed in", async ({ adminRequest: request }) => {
  // A schema violation (400), proving the session was accepted (otherwise 401).
  const res = await draft(request, { projectId: "p1", templateId: "gallery-delivery", instructions: "x".repeat(601) });
  expect(res.status()).toBe(400);
  const ok = await draft(request, { projectId: "p1", templateId: "gallery-delivery", instructions: "x".repeat(600) });
  expect(ok.status()).toBe(200);
});

test("draft-email: rejects an unknown template when signed in", async ({ adminRequest: request }) => {
  const res = await draft(request, { projectId: "p1", templateId: "not-a-real-template" });
  expect(res.status()).toBe(400);
});

test("draft-email: no project, no draft, with a template or without", async ({ adminRequest: request }) => {
  for (const data of [{ templateId: "gallery-delivery", instructions: "warmer tone" }, {}]) {
    const res = await draft(request, { projectId: "p1", ...data });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, drafted: false });
  }
});

test("draft-email: only addresses the model was given survive", () => {
  const allowed = ["https://site.example/portfolio/weddings", "https://site.example/portal/projects/1"];
  expect(
    neutraliseLinks(
      "See https://site.example/portfolio/weddings. Or https://other.example/x, and https://site.example/portal/projects/1).",
      allowed,
    ),
  ).toBe("See https://site.example/portfolio/weddings. Or [link], and https://site.example/portal/projects/1).");
  expect(neutraliseLinks("No links here.", allowed)).toBe("No links here.");
  // A link the model lengthened is a different link.
  expect(neutraliseLinks("https://site.example/portal/projects/1/x", allowed)).toBe("[link]");
});

test("draft-email: the answer's subject is read however it's marked", () => {
  expect(parseDraft("Subject: Hello\n\nHi,\n\nBody.", "Fallback")).toEqual({ subject: "Hello", body: "Hi,\n\nBody." });
  expect(parseDraft("Here's the email:\n\n**Subject:** Hello\n\nHi,", "Fallback")).toEqual({ subject: "Hello", body: "Hi," });
  expect(parseDraft("**Subject**: *Hello*\r\n\r\nHi,", "Fallback")).toEqual({ subject: "Hello", body: "Hi," });
  // No subject line, or one with nothing after it: the fallback, and the whole text.
  expect(parseDraft("Hi,\n\nBody.", "Fallback")).toEqual({ subject: "Fallback", body: "Hi,\n\nBody." });
  expect(parseDraft("Subject: Hello", "Fallback")).toEqual({ subject: "Fallback", body: "Subject: Hello" });
});

test("draft-email: the portfolio a draft may link, and the service's turnaround", () => {
  const page = (slug: string, images: number, hidden = false) => ({ slug, title: slug, hidden, images: Array(images).fill({}), videos: [] });
  const pages = [page("weddings", 2), page("empty", 0), page("secret", 3, true), ...["a", "b", "c", "d", "e", "f"].map((x) => page(x, 1))];
  // The sample gallery first, then up to five pages with work on them.
  expect(portfolioLines(pages as never, `${SITE_URL}/portfolio/weddings`, 5)).toEqual([
    `A sample gallery for this service: ${SITE_URL}/portfolio/weddings`,
    ...["a", "b", "c", "d", "e"].map((x) => `${x}: ${SITE_URL}/portfolio/${x}`),
  ]);
  expect(portfolioLines(pages as never, undefined, 2)).toEqual([
    `weddings: ${SITE_URL}/portfolio/weddings`,
    `a: ${SITE_URL}/portfolio/a`,
  ]);
  expect(turnaroundLine({ turnaroundDays: 42 })).toBe("Gallery turnaround: 42 days after the shoot.");
  expect(turnaroundLine({ turnaroundDays: 0 })).toBeUndefined();
  expect(turnaroundLine(undefined)).toBeUndefined();
});

test("draft-email: a column the store doesn't have yet is recognised by name", () => {
  const read = { code: "42703", message: "column client_messages.ai_drafted does not exist" };
  const write = { code: "PGRST204", message: "Could not find the 'ai_drafted' column of 'client_messages' in the schema cache" };
  expect(missingColumn(read, /\bai_drafted\b/)).toBe(true);
  expect(missingColumn(write, /\bai_drafted\b/)).toBe(true);
  // Another column, another error, or none.
  expect(missingColumn(read, /\btemplate\b/)).toBe(false);
  expect(missingColumn({ code: "23505", message: "ai_drafted" }, /\bai_drafted\b/)).toBe(false);
  expect(missingColumn(null, /\bai_drafted\b/)).toBe(false);
});

test.describe("with the test store", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  test("the model never gets the client's email, phone or the link's key, and the draft keeps the keyed link", async ({
    adminRequest: request,
    fakes,
    baseURL,
  }) => {
    const email = `e2e-draft-${Date.now()}@example.com`;
    const created = await request.post("/api/admin/create-project", {
      data: { email, clientName: "E2E Draft", phone: "(703) 555-0142", serviceType: "weddings", force: true },
    });
    const { id } = await created.json();

    // The model answers with the questionnaire link exactly as it was given it.
    const bare = `${baseURL}/questionnaire/weddings?project=${id}`;
    await fakes.script({ replies: [`Subject: Planning your wedding\n\nHi,\n\nThe questionnaire is here: ${bare}\n\nJulian`] });
    const res = await draft(request, { projectId: id, templateId: "planning-kickoff" });
    expect(res.status()).toBe(200);
    const drafted = await res.json();
    expect(drafted.drafted).toBe(true);

    // What went to the provider: the form's address, without its key or any of
    // the contact details (the questionnaire line carries the link too).
    const sent = JSON.stringify((await fakes.calls("ai")).map((c) => c.body));
    expect(sent).toContain(bare);
    expect(sent).not.toContain("key=");
    expect(sent).not.toContain(email);
    expect(sent).not.toContain(encodeURIComponent(email));
    expect(sent).not.toContain("555-0142");
    expect(sent).not.toContain("5550142");

    // What comes back to Compose: the keyed link, which opens the form with
    // their details, and still carries none of them.
    const key = createHmac("sha256", AUTH_SECRET).update(`form:${id}`).digest("hex").slice(0, 16);
    expect(drafted.body).toContain(`${bare}&key=${key}`);
    expect(drafted.body).not.toContain(encodeURIComponent(email));

    // The questionnaire line in a template the client gets before the shoot
    // carries the link too, without its key on the way to the model.
    await fakes.script({
      replies: [`Subject: Your wedding inquiry\n\nHi,\n\nThe planning questionnaire helps me prepare: ${bare}\n\nJulian`],
    });
    const before = (await fakes.calls("ai")).length;
    const reply = await draft(request, { projectId: id, templateId: "inquiry-reply" });
    const replied = await reply.json();
    const asked = JSON.stringify((await fakes.calls("ai")).slice(before).map((c) => c.body));
    expect(asked).toContain(`already filled in with what I have: ${bare}`);
    expect(asked).not.toContain("key=");
    expect(replied.body).toContain(`${bare}&key=${key}`);
  });

  test("what the client said on the call shapes the draft; Julian's own notes and the budget never reach it", async ({
    adminRequest: request,
    fakes,
  }) => {
    const p = await newProject(request, "Draft call");
    await patchProject(p.id, {
      status: "in-conversation",
      budget: "$9,871",
      referral: "venue",
      inquiry_message: "INQUIRY-SENTINEL We'd love a candid wedding. Call me on 703-555-0187.",
      calls: {
        discovery: {
          answers: { "warm-open.how-met": "ANSWER-SENTINEL" },
          notes: "NOTES-SENTINEL raw jottings",
          summary: {
            background: "BACKGROUND-SENTINEL met through a friend",
            event: "EVENT-SENTINEL a fall vineyard day",
            priorities: "PRIORITIES-SENTINEL candid moments",
            logistics: "LOGISTICS-SENTINEL budget is tight",
            actions: "ACTIONS-SENTINEL send the proposal by Friday",
          },
        },
      },
      ai_results: {
        triage: {
          result: {
            summary: "A fall wedding.",
            fit: "good",
            fitReason: "",
            urgency: "low",
            urgencyReason: "",
            keyDetails: ["KEYDETAIL-SENTINEL budget $9,871"],
          },
        },
      },
    });
    const since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    expect((await (await draft(request, { projectId: p.id, templateId: "proposal-follow-up" })).json()).drafted).toBe(true);
    const [prompt] = await promptsSince(fakes, since);

    // The client's side of the call, on a template that isn't the recap.
    for (const s of ["BACKGROUND-SENTINEL", "EVENT-SENTINEL", "PRIORITIES-SENTINEL"]) expect(prompt).toContain(s);
    // His action items, as guidance under their own heading.
    const guidance = prompt.indexOf("Julian's own to-do list from the call");
    expect(guidance).toBeGreaterThan(-1);
    expect(prompt.indexOf("ACTIONS-SENTINEL")).toBeGreaterThan(guidance);
    // Never his budget notes, raw notes or answers, the assessment's details,
    // the budget, or how they found him; the inquiry gives way to the call.
    for (const s of ["LOGISTICS-SENTINEL", "NOTES-SENTINEL", "ANSWER-SENTINEL", "KEYDETAIL-SENTINEL", "9,871", "INQUIRY-SENTINEL"]) {
      expect(prompt).not.toContain(s);
    }
    expect(prompt).not.toMatch(/how they found/i);
    // Its rules: client words are material, and no budget.
    expect(prompt).toContain('Text between """ lines was written by the client or noted by Julian');
    expect(prompt).toContain("Never mention a budget");

    // Before a summary, the inquiry, without its phone number.
    const q = await newProject(request, "Draft inquiry");
    await patchProject(q.id, { inquiry_message: "INQUIRY-SENTINEL Call me on 703-555-0187." });
    const next = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: q.id, templateId: "inquiry-reply" });
    const [early] = await promptsSince(fakes, next);
    expect(early).toContain("INQUIRY-SENTINEL");
    expect(early).toContain("[phone]");
    expect(early).not.toContain("555-0187");
  });

  test("the conversation is the client's view of the thread: the last six, without anyone else's mail", async ({
    adminRequest: request,
    fakes,
  }) => {
    const p = await newProject(request, "Draft thread");
    const at = (n: number) => new Date(Date.now() - (20 - n) * 60_000).toISOString();
    await addMessage(p.id, { direction: "in", body: "MSG-0 the oldest", sentAt: at(0) });
    await addMessage(p.id, { direction: "in", body: "MSG-1 first", sentAt: at(1) });
    await addMessage(p.id, { direction: "out", body: "MSG-2 Julian answers", sentAt: at(2) });
    await addMessage(p.id, { direction: "in", body: "VENDOR-SENTINEL", fromAddr: "Venue <events@venue.example>", sentAt: at(3) });
    await addMessage(p.id, { direction: "in", body: "MSG-4 my number is (703) 555-0123", sentAt: at(4) });
    await addMessage(p.id, { direction: "out", body: "MSG-5 Julian again", sentAt: at(5) });
    await addMessage(p.id, { direction: "in", body: "HELD-SENTINEL", status: "unverified", sentAt: at(6) });
    await addMessage(p.id, { direction: "in", body: "MSG-7 the timeline question", subject: "Re: Timeline question", sentAt: at(7) });
    // Julian's mail to the venue, filed from Gmail: his, but not the client's to read.
    await addMessage(p.id, {
      direction: "out",
      kind: "imported",
      body: "VENUE-OUT-SENTINEL",
      toAddr: "Venue <events@venue.example>",
      sentAt: at(7.5),
    });
    await addMessage(p.id, { direction: "out", body: "MSG-8 Julian last", subject: "Your proposal", sentAt: at(8) });

    const since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "proposal-follow-up" });
    const [prompt] = await promptsSince(fakes, since);
    for (const s of ["MSG-1", "MSG-2", "MSG-4", "MSG-5", "MSG-7", "MSG-8"]) expect(prompt).toContain(s);
    for (const s of ["MSG-0", "VENDOR-SENTINEL", "HELD-SENTINEL", "VENUE-OUT-SENTINEL", "555-0123"]) {
      expect(prompt).not.toContain(s);
    }
    expect(prompt).toContain("Client: MSG-1");
    expect(prompt).toContain("Julian: MSG-2");
    // Julian wrote last, so the template answers nothing in particular.
    expect(prompt).not.toContain("The client's message being answered");

    // Julian has answered: a plain reply needs a steer or a template.
    let next = (await fakes.calls("ai")).length;
    expect(await (await draft(request, { projectId: p.id })).json()).toEqual({ ok: true, drafted: false, reason: "answered" });
    // With a steer, a follow-up in the conversation, under its subject.
    await fakes.script({ replies: ["Subject: Something new\n\nHi,\n\nOne more thing.\n\nJulian"] });
    const followUp = await (await draft(request, { projectId: p.id, instructions: "Mention the second shooter" })).json();
    expect(followUp).toMatchObject({ drafted: true, subject: "Re: Your proposal" });
    let [plain] = await promptsSince(fakes, next);
    expect(plain).toContain("There's no message of theirs to answer.");
    expect(plain).not.toContain("The client's message being answered");

    // The client writes again: a plain reply answers that message, under the
    // conversation's subject (its "Re:" kept once) whatever the model wrote.
    await addMessage(p.id, { direction: "in", body: "MSG-9 one more question", subject: "Re: Timeline question, call 703-555-0144", sentAt: at(9) });
    next = (await fakes.calls("ai")).length;
    await fakes.script({ replies: ["Subject: A brand new subject\n\nHi,\n\nHappy to walk through the timeline.\n\nJulian"] });
    const replied = await (await draft(request, { projectId: p.id })).json();
    expect(replied).toMatchObject({ drafted: true, subject: "Re: Timeline question, call 703-555-0144" });
    expect(replied.body).toContain("Happy to walk through the timeline.");
    [plain] = await promptsSince(fakes, next);
    expect(plain).toContain("Write a reply in the ongoing conversation");
    // The client's subject never goes to the model (it may carry a number).
    expect(plain).not.toContain("Timeline question");
    expect(plain).not.toContain("555-0144");
    expect(plain).toMatch(/The client's message being answered:\n"""\nMSG-9 one more question\n"""/);
    expect(plain).not.toContain("Here is the template");
  });

  test("a plain reply to a repeat inquiry is under the project's name, and a new inquiry has its own template", async ({
    adminRequest: request,
    fakes,
  }) => {
    const p = await newProject(request, "Draft repeat");
    await patchProject(p.id, { inquiry_message: "Our first inquiry." });
    expect(await (await draft(request, { projectId: p.id })).json()).toEqual({ ok: true, drafted: false, reason: "inquiry" });

    await addMessage(p.id, { direction: "in", kind: "inquiry", subject: "New inquiry: weddings", body: "Could we add an engagement session?" });
    await fakes.script({ replies: [REPLY] });
    const replied = await (await draft(request, { projectId: p.id })).json();
    expect(replied).toMatchObject({ drafted: true, subject: `Re: ${p.name}'s Wedding` });
  });

  test("a plain reply with nothing to answer isn't drafted, unless Julian steers it", async ({ adminRequest: request, fakes }) => {
    const p = await newProject(request, "Draft nothing");
    const since = (await fakes.calls("ai")).length;
    expect(await (await draft(request, { projectId: p.id })).json()).toEqual({
      ok: true,
      drafted: false,
      reason: "nothing-to-answer",
    });
    expect(await promptsSince(fakes, since)).toEqual([]);

    await fakes.script({ replies: [REPLY] });
    const steered = await (await draft(request, { projectId: p.id, instructions: "Check in about the date" })).json();
    expect(steered.drafted).toBe(true);
    const [prompt] = await promptsSince(fakes, since);
    expect(prompt).toContain("Julian's steer for this draft: Check in about the date");
  });

  test("the questionnaire: its link while it isn't back, its answers once it is", async ({ adminRequest: request, fakes, baseURL }) => {
    const p = await newProject(request, "Draft questionnaire");
    const bare = `${baseURL}/questionnaire/weddings?project=${p.id}`;
    let since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "proposal-follow-up" });
    let [prompt] = await promptsSince(fakes, since);
    expect(prompt).toContain(`Planning questionnaire: not back yet. Its link: ${bare}`);
    expect(prompt).toContain("ask for the questionnaire once, briefly");

    // An email that closes the project doesn't ask.
    since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "not-available" });
    [prompt] = await promptsSince(fakes, since);
    expect(prompt).not.toContain("Planning questionnaire");

    // Back: the answers, without contact details or how they found Julian.
    await patchProject(p.id, {
      questionnaire_snapshot: JSON.stringify({
        fullName: "E2E Draft questionnaire",
        email: "e2e-q-contact@example.com",
        phone: "(703) 555-0177",
        referral: "REFERRAL-SENTINEL",
        gettingReady: "ANSWERS-SENTINEL at the hotel",
      }),
    });
    since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "proposal-follow-up" });
    [prompt] = await promptsSince(fakes, since);
    expect(prompt).toContain("Planning questionnaire: back. Don't ask for it again.");
    expect(prompt).toContain("ANSWERS-SENTINEL");
    for (const s of ["REFERRAL-SENTINEL", "e2e-q-contact@example.com", "555-0177", "not back yet"]) {
      expect(prompt).not.toContain(s);
    }
  });

  test("payment facts only while an invoice is open", async ({ adminRequest: request, fakes }) => {
    const p = await newProject(request, "Draft payment");
    await patchProject(p.id, { status: "booked", payment_method: "zelle" });
    let since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "payment-reminder" });
    let [prompt] = await promptsSince(fakes, since);
    expect(prompt).not.toContain("Pay by Zelle");
    expect(prompt).not.toContain("Open invoice");

    await patchProject(p.id, {
      documents: [{ id: "inv-1", type: "invoice", label: "Retainer", url: "https://pay.example.com/r1", uploadedBy: "julian", dueAt: "2099-01-15" }],
    });
    since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: p.id, templateId: "payment-reminder" });
    [prompt] = await promptsSince(fakes, since);
    expect(prompt).toContain("Open invoice: https://pay.example.com/r1");
    expect(prompt).toContain("How this client is paying: Pay by Zelle.");
  });

  test("the draft keeps only links it was given, puts the form's key back, and reads a subject however it's marked", async ({
    adminRequest: request,
    fakes,
    baseURL,
  }) => {
    const p = await newProject(request, "Draft links");
    const bare = `${baseURL}/questionnaire/weddings?project=${p.id}`;
    const portal = `${baseURL}/portal/projects/${p.id}`;
    await fakes.script({
      replies: [
        `Here's the email:\n\n**Subject:** Your planning\n\nHi,\n\nYour portal: ${portal}\nThe form: ${bare}\nSome inspiration: https://made-up.example.com/ideas.\n\nJulian`,
      ],
    });
    const drafted = await (await draft(request, { projectId: p.id, templateId: "planning-kickoff" })).json();
    expect(drafted.subject).toBe("Your planning");
    expect(drafted.body.startsWith("Hi,")).toBe(true);
    expect(drafted.body).toContain(`Your portal: ${portal}`);
    expect(drafted.body).toMatch(new RegExp(`The form: ${bare.replace(/[.?]/g, "\\$&")}&key=[0-9a-f]{16}`));
    expect(drafted.body).toContain("Some inspiration: [link].");
    expect(drafted.body).not.toContain("made-up.example.com");
  });

  test("a reply that isn't drafted says why: Julian answered, the inquiry waits, or the client hasn't written", async ({
    adminRequest: request,
    fakes,
  }) => {
    const since = (await fakes.calls("ai")).length;
    const reason = async (id: string) => (await (await draft(request, { projectId: id })).json()).reason;
    // Only Julian has written, on a project with no inquiry: nothing to answer.
    const a = await newProject(request, "Draft reason out");
    await addMessage(a.id, { direction: "out", body: "An invitation to a call." });
    expect(await reason(a.id)).toBe("nothing-to-answer");
    // An inquiry answered outside the site (the project moved on by hand),
    // or one booked straight away: answered, not waiting.
    const b = await newProject(request, "Draft reason responded");
    await patchProject(b.id, { inquiry_message: "Are you free in June?", status: "responded" });
    expect(await reason(b.id)).toBe("answered");
    const c = await newProject(request, "Draft reason booked");
    await patchProject(c.id, {
      inquiry_message: "Are you free in June?",
      documents: [{ id: "k", type: "contract", label: "Contract", url: "https://sign.example.com/k", uploadedBy: "julian" }],
    });
    expect(await reason(c.id)).toBe("answered");
    // Still waiting: the inquiry reply.
    await patchProject(c.id, { documents: [] });
    expect(await reason(c.id)).toBe("inquiry");
    expect(await promptsSince(fakes, since)).toEqual([]);
  });

  test("a questionnaire link pasted into the steer loses its key on the way, and comes back keyed once", async ({
    adminRequest: request,
    fakes,
    baseURL,
  }) => {
    const p = await newProject(request, "Draft steer link");
    const key = createHmac("sha256", AUTH_SECRET).update(`form:${p.id}`).digest("hex").slice(0, 16);
    const bare = `${baseURL}/questionnaire/weddings?project=${p.id}`;
    const keyed = `${bare}&key=${key}`;
    const since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [`Subject: The form\n\nHi,\n\nHere it is: ${bare}\n\nJulian`] });
    const drafted = await (
      await draft(request, { projectId: p.id, templateId: "planning-kickoff", instructions: `Send them ${keyed} please` })
    ).json();
    const sent = JSON.stringify((await fakes.calls("ai")).slice(since).map((c) => c.body));
    expect(sent).toContain(`Send them ${bare} please`);
    expect(sent).not.toContain("key=");
    expect(drafted.body).toContain(`Here it is: ${keyed}\n`);
    expect(drafted.body).not.toContain(`${keyed}&key=`);
  });

  test("links the template carries survive the draft", async ({ adminRequest: request, fakes, baseURL }) => {
    const calls = siteSettingsFallback.calls;
    const cases: { status?: string; template: string; link: string }[] = [
      { status: "delivered", template: "gallery-delivery", link: siteSettingsFallback.googleProfileUrl ?? "" },
      { status: "complete", template: "anniversary", link: `${baseURL}/book` },
      { status: "lost", template: "re-engagement", link: calls.discoveryCall.url },
      { template: "planning-kickoff", link: calls.weddingTimelineCall.url },
    ];
    for (const c of cases) {
      expect(c.link, c.template).toMatch(/^https?:\/\//);
      const p = await newProject(request, `Draft keeps ${c.template}`);
      if (c.status) await patchProject(p.id, { status: c.status });
      await fakes.script({ replies: [`Subject: Hello\n\nHi,\n\nHere it is: ${c.link}\n\nJulian`] });
      const drafted = await (await draft(request, { projectId: p.id, templateId: c.template })).json();
      expect(drafted.body, c.template).toContain(`Here it is: ${c.link}`);
    }
  });

  test("the worst-case project fits the provider's per-minute limit on both models", async ({ adminRequest: request, request: anon, fakes }) => {
    // The daily job picks the models: main openai/gpt-oss-120b, fallback qwen/qwen3-32b.
    const cron = await anon.get("/api/cron/keepalive", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(cron.status()).toBe(200);
    const p = await newProject(request, "Draft worst case");
    const long = (tag: string, n: number) => `${tag} ${"a long line of text ".repeat(Math.ceil(n / 20))}`.slice(0, n);
    await patchProject(p.id, {
      status: "in-conversation",
      package: "Platinum",
      plan_summary: long("PLAN", 10_000),
      inquiry_message: long("INQUIRY", 6000),
      calls: {
        discovery: {
          summary: {
            background: long("BG", 4000),
            event: long("EV", 4000),
            priorities: long("PR", 4000),
            logistics: long("LOG", 4000),
            actions: long("ACT", 4000),
          },
        },
      },
      questionnaire_snapshot: JSON.stringify({ gettingReady: long("Q", 9000), timeline: long("T", 9000) }),
      documents: [
        { id: "inv-w", type: "invoice", label: "Retainer", url: "https://pay.example.com/w", uploadedBy: "julian" },
        // A link too long to carry is left out, for Julian to fill in.
        { id: "prop-w", type: "proposal", label: "Proposal", url: `https://docs.example.com/${"p".repeat(1000)}`, uploadedBy: "julian" },
      ],
      payment_method: "zelle",
    });
    for (let i = 0; i < 9; i++) {
      await addMessage(p.id, { direction: i % 2 ? "out" : "in", body: long(`M${i}`, 3000), sentAt: new Date(Date.now() - (10 - i) * 60_000).toISOString() });
    }
    // Other projects' sent mail over 900 characters, for the voice samples.
    const other = await newProject(request, "Draft voice source");
    for (let i = 0; i < 3; i++) await addMessage(other.id, { direction: "out", body: long(`VOICE${i}`, 2000) });

    const since = (await fakes.calls("ai")).length;
    await fakes.script({ tooLarge: ["openai/gpt-oss-120b"], replies: [REPLY] });
    // The recap is the longest template, and reads every part of the call.
    const res = await draft(request, { projectId: p.id, templateId: "discovery-recap", instructions: "x".repeat(600) });
    expect((await res.json()).drafted).toBe(true);
    await fakes.script({ tooLarge: [] });

    const tried = (await fakes.calls("ai")).slice(since).filter((c) => c.path === "/chat/completions");
    expect(tried.map((c) => [c.body?.model, c.body?.max_tokens])).toEqual([
      ["openai/gpt-oss-120b", 2300],
      ["qwen/qwen3-32b", 800],
    ]);
    // The whole request, the system prompt included.
    for (const call of tried) {
      const messages = (call.body?.messages ?? []) as { content: string }[];
      const size = messages.reduce((n, m) => n + m.content.length, 0);
      expect(size).toBeLessThanOrEqual(17_800);
      expect(messages.map((m) => m.content).join("")).not.toContain("docs.example.com");
    }
  });

  test("Compose drafts a plain reply, and the send records that it began as an AI draft", async ({
    adminRequest: request,
    adminPage: page,
    fakes,
  }) => {
    const p = await newProject(request, "Draft compose");
    await page.goto(`/admin/projects/${p.id}?tab=messages`);
    const panel = page.locator("#compose");
    await expect(panel.getByRole("combobox", { name: "Email template" })).toHaveValue("");
    await expect(panel.getByText("Draft a reply with AI")).toBeVisible();
    await expect(panel.getByLabel("Extra instructions for the AI draft")).toHaveAttribute("maxlength", "600");
    // Nothing from the client yet: it says so, and asks the AI nothing.
    const since = (await fakes.calls("ai")).length;
    await panel.getByRole("button", { name: "Draft with AI" }).click();
    await expect(panel.getByText("There's no message from the client to answer yet. Pick a template, or add a steer.")).toBeVisible();
    expect(await promptsSince(fakes, since)).toEqual([]);

    await addMessage(p.id, { direction: "in", body: "Do you shoot film as well?", subject: "Film?" });
    await page.reload();
    await fakes.script({ replies: ["Subject: Re: Film?\n\nHi,\n\nI do, on request.\n\nJulian"] });
    await panel.getByRole("button", { name: "Draft with AI" }).click();
    await expect(panel.getByLabel("Email body")).toHaveValue(/I do, on request\./);
    await expect(panel.getByLabel("Subject")).toHaveValue("Re: Film?");
    // Edited, then sent: still an AI draft.
    await panel.getByLabel("Email body").fill("Hi,\n\nI do, on request, and I love it.\n\nJulian");
    await panel.getByRole("button", { name: "Send to client" }).click();
    await expect(panel.getByText(/^Sent to the client\./)).toBeVisible();
    const { data } = await testStore()!
      .from("client_messages")
      .select("ai_drafted, body_text")
      .eq("project_id", p.id)
      .eq("direction", "out");
    expect(data).toEqual([{ ai_drafted: true, body_text: "Hi,\n\nI do, on request, and I love it.\n\nJulian" }]);
  });

  test("a sent AI draft is recorded as one, and never becomes a voice sample", async ({ adminRequest: request, fakes }) => {
    const a = await newProject(request, "Draft sent");
    const mine = "OWN-WORDS-SENTINEL Thanks so much for the call today. I loved hearing about the day you have planned, and I'll send the proposal over by the end of the week.";
    const ai = "AI-WORDS-SENTINEL Thank you for a lovely call today. It was a joy to hear about everything you have planned, and the proposal will follow by the end of the week.";
    const send = (body: string, aiDrafted?: boolean) =>
      request.post("/api/admin/send-email", {
        data: { projectId: a.id, subject: "After our call", body, idempotencyKey: randomUUID(), aiDrafted },
      });
    expect((await send(ai, true)).status()).toBe(200);
    expect((await send(mine)).status()).toBe(200);

    const { data } = await testStore()!
      .from("client_messages").select("body_text, ai_drafted").eq("project_id", a.id).eq("direction", "out");
    const rows = (data ?? []) as { body_text: string; ai_drafted: boolean }[];
    expect(rows.find((r) => r.body_text.startsWith("AI-WORDS"))?.ai_drafted).toBe(true);
    expect(rows.find((r) => r.body_text.startsWith("OWN-WORDS"))?.ai_drafted).toBe(false);

    const b = await newProject(request, "Draft samples");
    const since = (await fakes.calls("ai")).length;
    await fakes.script({ replies: [REPLY] });
    await draft(request, { projectId: b.id, templateId: "inquiry-reply" });
    const [prompt] = await promptsSince(fakes, since);
    expect(prompt).toContain("OWN-WORDS-SENTINEL");
    expect(prompt).not.toContain("AI-WORDS-SENTINEL");
  });
});
