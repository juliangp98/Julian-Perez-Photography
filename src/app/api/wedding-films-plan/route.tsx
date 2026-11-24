// POST /api/wedding-films-plan: renders and returns the Wedding Films Plan PDF.
// Mirrors /api/wedding-plan with the "wedding-films" questionnaire and its own
// document component; stores nothing and sends no email.

export const runtime = "nodejs";

import { z } from "zod";
import {
  getQuestionnaire,
  visibleSectionsFor,
  evaluateShowIf,
} from "@/lib/questionnaires";
import { isHoneypotTriggered } from "@/lib/request-guard";
import { apiError, defineRoute } from "@/lib/api-route";

export const POST = defineRoute({
  route: "wedding-films-plan",
  auth: "public",
  schema: z.object({
    service: z.unknown().optional(),
    hp_company: z.unknown().optional(),
    answers: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional(),
  }),
  // Same per-IP cap as /api/wedding-plan: preview and download can fire
  // several times during a real edit cycle.
  rateLimit: { max: 10, windowMs: 10 * 60 * 1000 },
  failure: { status: 500, error: "Could not generate the PDF. Please try again." },
  run: async (body) => {
    // Honeypot: an empty 200 so bots don't learn the trap exists.
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
    if (!q) return apiError(400, "Unknown questionnaire.");

    const answers = body.answers || {};

    // Required-field check mirrors the client-side validator, over visible
    // sections only so a hidden tier-conditional doesn't trip the gate.
    for (const section of visibleSectionsFor(q, answers)) {
      for (const f of section.fields) {
        if (!f.required) continue;
        if (!evaluateShowIf(f.showIf, answers)) continue;
        const v = answers[f.id];
        if (v === undefined || v === "") {
          return apiError(400, `Missing required field: ${f.label}`);
        }
      }
    }

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { WeddingFilmsPlan } = await import("@/lib/pdf/wedding-films-plan");
    const buffer = await renderToBuffer(<WeddingFilmsPlan answers={answers} />);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Wedding-Films-Plan.pdf"',
      },
    });
  },
});
