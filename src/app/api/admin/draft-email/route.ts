// POST /api/admin/draft-email: owner-only. Drafts a personalized email from a
// pipeline template and the project's own record; it never sends, and never
// passes the owner's notes, budget, the client's email or phone, or body-supplied
// PII to the model.

export const runtime = "nodejs";

import { z } from "zod";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { EMAIL_TEMPLATES, fillTemplate } from "@/lib/email/email-pipeline";
import { emailTokens } from "@/lib/email/email-tokens";
import { projectLinks } from "@/lib/project-links";
import { getAnyService } from "@/lib/content";
import { holdUntilFor } from "@/lib/email/send-effects";
import { formatHumanDate, studioToday } from "@/lib/field-format";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { buildVoiceSystemPrompt } from "@/lib/ai/ai-voice";
import { pickVoiceSamples, voiceSection } from "@/lib/ai/voice-samples";
import { listOwnerWriting } from "@/lib/messages";
import { projectFacts, withoutContacts } from "@/lib/ai/project-context";
import { SUMMARY_PARTS } from "@/lib/calls";

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
    // One exception on the way to the model: the questionnaire link is prefilled
    // with the client's email and phone, so the prompt carries the same form's
    // address without them, and the real link is put back into the draft.
    const origin = originOf(req);
    const filled = await emailTokens(record, origin);
    const realQuestionnaireUrl = filled.questionnaireUrl;
    const bareQuestionnaireUrl = projectLinks(record, origin).questionnaireBareUrl;
    // The hold this template names: the running one, or the one sending it
    // would start.
    const service = record.serviceType ? await getAnyService(record.serviceType) : undefined;
    const hold = holdUntilFor(template, record, {
      today: studioToday(),
      holdDays: service?.holdDays,
    });
    const ctx: Record<string, string | undefined> = {
      ...filled,
      questionnaireUrl: bareQuestionnaireUrl,
      holdUntil: formatHumanDate(hold) || undefined,
    };
    const withRealLinks = (text: string) =>
      bareQuestionnaireUrl && realQuestionnaireUrl
        ? text.replaceAll(bareQuestionnaireUrl, realQuestionnaireUrl)
        : text;
    // The project at the client tier (projectFacts): nothing private, since
    // the draft is written to the client.
    const facts = projectFacts(record, "client");
    // The recap after a discovery call draws on what the client told Julian on
    // it: the summary's first three parts, never his budget notes or to-dos.
    const summary = record.calls?.discovery?.summary;
    if (template.id === "discovery-recap" && summary) {
      for (const part of SUMMARY_PARTS.filter((p) => p.clientSafe)) {
        const text = summary[part.key]?.trim();
        if (text) facts.push(`From the call, ${part.label.toLowerCase()}:\n${withoutContacts(text)}`);
      }
    }
    if (ctx.packagePrice) facts.push(`Package price: ${ctx.packagePrice}`);
    if (ctx.packageInclusions)
      facts.push(`What the package includes:\n${ctx.packageInclusions}`);
    // The links Julian has added to the project, so a draft can point at the
    // real proposal, contract, invoice, highlights or gallery.
    if (ctx.proposalUrl) facts.push(`Proposal link: ${ctx.proposalUrl}`);
    if (ctx.contractUrl) facts.push(`Contract link: ${ctx.contractUrl}`);
    if (ctx.invoiceUrl) facts.push(`Invoice link: ${ctx.invoiceUrl}`);
    if (ctx.highlightsUrl) facts.push(`Highlights link: ${ctx.highlightsUrl}`);
    if (ctx.galleryUrl) facts.push(`Gallery link: ${ctx.galleryUrl}`);
    if (ctx.timelineUrl) facts.push(`Timeline link: ${ctx.timelineUrl}`);
    if (ctx.invoiceDueDate) facts.push(`Invoice due: ${ctx.invoiceDueDate}`);
    // Booking terms from the service, when set.
    if (ctx.sampleGalleryUrl) facts.push(`Sample gallery link: ${ctx.sampleGalleryUrl}`);
    if (ctx.retainerPercent) facts.push(`Retainer to book: ${ctx.retainerPercent}%`);
    if (ctx.holdUntil) facts.push(`Date held for the client until: ${ctx.holdUntil}`);
    if (ctx.paymentInstructions)
      facts.push(`How this client is paying: ${ctx.paymentInstructions}`);
    facts.push(`Client portal link: ${ctx.portalUrl}`);
    if (ctx.questionnaireUrl)
      facts.push(`Planning questionnaire link: ${ctx.questionnaireUrl}`);
    facts.push(`Booking link: ${ctx.bookingUrl}`);
    if (ctx.discoveryCallUrl) facts.push(`Link to book a discovery call: ${ctx.discoveryCallUrl}`);
    if (ctx.reviewUrl) facts.push(`Link to leave a review: ${ctx.reviewUrl}`);

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
    return {
      ok: true,
      drafted: true,
      subject: withRealLinks(draft.subject),
      body: withRealLinks(draft.body),
    };
  },
});
