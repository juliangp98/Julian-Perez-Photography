// POST /api/wedding-plan: renders and returns the Wedding Day Plan PDF for the
// success screen's Preview and Download buttons. Takes the same { service,
// answers } payload as /api/questionnaire, stores nothing, and sends no email.

export const runtime = "nodejs";

import { z } from "zod";
import { getQuestionnaire, visibleSectionsFor, evaluateShowIf } from "@/lib/questionnaires";
import { isHoneypotTriggered } from "@/lib/request-guard";
import { apiError, defineRoute } from "@/lib/api-route";

export const POST = defineRoute({
  route: "wedding-plan",
  auth: "public",
  schema: z.object({
    service: z.unknown().optional(),
    hp_company: z.unknown().optional(),
    answers: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional(),
  }),
  // Higher than inquire/questionnaire because the preview button lets real
  // clients regenerate mid-edit; still low enough to stop a scraper.
  rateLimit: { max: 10, windowMs: 10 * 60 * 1000 },
  failure: { status: 500, error: "Could not generate the PDF. Please try again." },
  run: async (body) => {
    // Honeypot: an empty 200 so bots don't learn the field is a trap.
    if (isHoneypotTriggered(body.hp_company)) {
      return new Response("", { status: 200 });
    }

    if (body.service !== "weddings") {
      return apiError(400, "PDF generation is only available for weddings.");
    }

    const q = getQuestionnaire("weddings");
    if (!q) return apiError(400, "Unknown questionnaire.");

    const answers = body.answers || {};

    // Required visible fields must be present so the PDF isn't rendered with
    // empty sections; mirrors the form's own required/showIf logic.
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
    const { WeddingDayPlan } = await import("@/lib/pdf/wedding-day-plan");
    const buffer = await renderToBuffer(<WeddingDayPlan answers={answers} />);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Wedding-Day-Plan.pdf"',
      },
    });
  },
});
