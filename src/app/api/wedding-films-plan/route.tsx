// POST /api/wedding-films-plan — generates and returns a Wedding Films
// Plan PDF. Parallels /api/wedding-plan, scoped to the wedding-films
// questionnaire. Same rate-limit + honeypot + validation gates; the
// only meaningful divergence is the slug ("wedding-films" vs.
// "weddings") and the PDF document component.

export const runtime = "nodejs";

import {
  getQuestionnaire,
  visibleSectionsFor,
  evaluateShowIf,
} from "@/lib/questionnaires";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { apiError } from "@/lib/api-response";
import * as Sentry from "@sentry/nextjs";

type Answers = Record<string, string | string[]>;

export async function POST(req: Request) {
  // Same per-IP cap as /api/wedding-plan — preview + download from the
  // success screen can fire several times during a real edit cycle.
  const limited = rateLimitResponse(req, {
    key: "wedding-films-plan",
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

  // Honeypot — silent 200 so bots don't learn the trap exists.
  if (isHoneypotTriggered(body.hp_company)) {
    return new Response("", { status: 200 });
  }

  if (body.service !== "wedding-films") {
    return apiError(
      400,
      "PDF generation on this route is only available for wedding films.",
    );
  }

  const q = getQuestionnaire("wedding-films");
  if (!q) {
    return apiError(400, "Unknown questionnaire.");
  }

  const answers = body.answers || {};

  // Required-field check mirrors the client-side validator — visible
  // sections only (so a hidden tier-conditional doesn't trip the gate).
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

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { WeddingFilmsPlan } = await import("@/lib/pdf/wedding-films-plan");
    const buffer = await renderToBuffer(
      <WeddingFilmsPlan answers={answers} />,
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Wedding-Films-Plan.pdf"',
      },
    });
  } catch (err) {
    console.error("[wedding-films-plan] PDF render failed:", err);
    Sentry.captureException(err, {
      tags: { route: "wedding-films-plan", stage: "pdf-render" },
    });
    return apiError(500, "Could not generate the PDF. Please try again.");
  }
}
