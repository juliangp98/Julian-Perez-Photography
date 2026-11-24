// POST /api/admin/draft-email: owner-only. Drafts a personalized email from a
// pipeline template and the project's own record; it never sends, and never
// passes internal notes, budget, or body-supplied PII to the model.

export const runtime = "nodejs";

import { z } from "zod";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { EMAIL_TEMPLATES, fillTemplate } from "@/lib/email/email-pipeline";
import { emailTokens } from "@/lib/email/email-tokens";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { buildVoiceSystemPrompt } from "@/lib/ai/ai-voice";
import { pickVoiceSamples, voiceSection } from "@/lib/ai/voice-samples";
import { listOwnerWriting } from "@/lib/messages";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";

const schema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  instructions: z.string().max(2000).optional(),
});

// Split the model's "Subject: …\n\n<body>" output; fall back to the template's
// own subject if the model didn't follow the format.
function parseDraft(
  text: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const m = text.match(/^\s*subject:\s*(.+?)[\r\n]+([\s\S]*)$/i);
  if (m && m[2].trim()) {
    return { subject: m[1].trim(), body: m[2].trim() };
  }
  return { subject: fallbackSubject, body: text.trim() };
}

export const POST = defineRoute({
  route: "admin/draft-email",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data, { req }) => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === data.templateId);
    if (!template) return apiError(400, "Unknown template.");

    // Not configured: the UI keeps the static template (no error).
    if (!aiEnabled()) return { ok: true, drafted: false };

    // Resolve the project server-side; never trust PII from the body.
    const record = await getClientFull(data.projectId);
    if (!record) return { ok: true, drafted: false };

    // The same tokens the compose panel fills, so links in the draft are real.
    const ctx = emailTokens(record, originOf(req));
    const { projectName: name, serviceNoun: noun, eventDate, venue } = ctx;

    // Minimal, client-appropriate facts: no internal notes, no budget.
    const facts: string[] = [];
    if (record.clientName) facts.push(`Client name: ${record.clientName}`);
    if (record.partnerName) facts.push(`Partner: ${record.partnerName}`);
    facts.push(`Project: ${name}`);
    if (noun) facts.push(`Service: ${noun}`);
    if (record.status) {
      const label = CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus];
      if (label) facts.push(`Current stage: ${label}`);
    }
    if (eventDate) facts.push(`Event date: ${eventDate}`);
    if (venue) facts.push(`Venue / location: ${venue}`);
    if (record.package) facts.push(`Package: ${record.package}`);
    if (record.guestCount != null)
      facts.push(`Guest count: ${record.guestCount}`);
    if (record.planSummary) facts.push(`Plan summary: ${record.planSummary}`);
    if (ctx.galleryUrl) facts.push(`Gallery link: ${ctx.galleryUrl}`);
    facts.push(`Client portal link: ${ctx.portalUrl}`);
    if (ctx.questionnaireUrl)
      facts.push(`Planning questionnaire link: ${ctx.questionnaireUrl}`);
    facts.push(`Booking link: ${ctx.bookingUrl}`);

    const guide = fillTemplate(template.body, ctx);
    // Julian's own recent emails, so drafts sound more like him over time. A
    // store hiccup just means a draft without examples.
    const samples = pickVoiceSamples(await listOwnerWriting(record.id).catch(() => []));
    const prompt = [
      `Write the "${template.name}" email for this client.`,
      "",
      "Here is the template I usually start from for this kind of email. Use it as a structural guide (keep its purpose and keep any URLs exactly as written), but personalize it so it reads as an individual note, not a form letter:",
      "----",
      `Subject: ${template.subject}`,
      "",
      guide,
      "----",
      "",
      "Facts about THIS client and project (use only these — do not invent anything not listed):",
      facts.map((f) => `- ${f}`).join("\n"),
      data.instructions?.trim()
        ? `\nExtra instructions for this specific draft: ${data.instructions.trim()}`
        : "",
      ...voiceSection(samples),
      "",
      "Now write the personalized email in the required Subject/body format.",
    ].join("\n");

    const raw = await generateText({
      system: buildVoiceSystemPrompt(),
      prompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    // Key vanished between the check and the call: fall back, don't error.
    if (!raw) return { ok: true, drafted: false };

    const draft = parseDraft(raw, fillTemplate(template.subject, ctx));
    return { ok: true, drafted: true, ...draft };
  },
});
