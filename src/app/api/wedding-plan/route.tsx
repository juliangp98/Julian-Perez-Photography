// POST /api/wedding-plan — generates and returns a Wedding Day Plan PDF.
//
// Called from the success screen's "Download" button. Accepts the same
// { service, answers } payload as /api/questionnaire but only returns the PDF.
// Error responses share the `{ error }` JSON envelope used by every
// other API route so the client UI can display a consistent message.

export const runtime = "nodejs";

import { getQuestionnaire, visibleSectionsFor, evaluateShowIf } from "@/lib/questionnaires";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { apiError } from "@/lib/api-response";

type Answers = Record<string, string | string[]>;

export async function POST(req: Request) {
  // Rate limit: 10 / 10 min / IP. Higher than inquire/questionnaire
  // because the preview button lets real clients regenerate mid-edit.
  // Still low enough to kneecap a scraper burning Vercel minutes.
  const limited = rateLimitResponse(req, {
    key: "wedding-plan",
    max: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { service?: string; hp_company?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON payload.");
  }

  // Honeypot — silently return an empty 200 so bots don't learn the
  // field is a trap. Human clients never populate it.
  if (isHoneypotTriggered(body.hp_company)) {
    return new Response("", { status: 200 });
  }

  if (body.service !== "weddings") {
    return apiError(400, "PDF generation is only available for weddings.");
  }

  const q = getQuestionnaire("weddings");
  if (!q) {
    return apiError(400, "Unknown questionnaire.");
  }

  const answers = body.answers || {};

  // Basic validation — ensure required visible fields are present so the
  // PDF isn't rendered with empty sections. The check mirrors the same
  // required/showIf logic the questionnaire form uses on the client.
  const visibleSections = visibleSectionsFor(q, answers);
  for (const section of visibleSections) {
    for (const f of section.fields) {
      if (!f.required) continue;
      if (!evaluateShowIf(f.showIf, answers)) continue;
      const v = answers[f.id];
      if (v === undefined || v === "") {
        return apiError(400, `Missing required field: ${f.label}`);
      }
    }
  }

  // Wrap the render in try/catch so a failure inside @react-pdf/renderer
  // (malformed answer, template bug, runtime OOM) surfaces as a clean
  // JSON error rather than a raw 500 with a stack trace.
  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { WeddingDayPlan } = await import("@/lib/wedding-day-plan");
    const buffer = await renderToBuffer(<WeddingDayPlan answers={answers} />);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Wedding-Day-Plan.pdf"',
      },
    });
  } catch (err) {
    console.error("[wedding-plan] PDF render failed:", err);
    return apiError(500, "Could not generate the PDF. Please try again.");
  }
}
