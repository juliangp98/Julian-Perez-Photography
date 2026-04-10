// POST /api/wedding-plan — generates and returns a Wedding Day Plan PDF.
//
// Called from the success screen's "Download" button. Accepts the same
// { service, answers } payload as /api/questionnaire but only returns the PDF.

import { getQuestionnaire, visibleSectionsFor, evaluateShowIf } from "@/lib/questionnaires";

type Answers = Record<string, string | string[]>;

export async function POST(req: Request) {
  let body: { service?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (body.service !== "weddings") {
    return new Response("PDF generation is only available for weddings", {
      status: 400,
    });
  }

  const q = getQuestionnaire("weddings");
  if (!q) {
    return new Response("Unknown questionnaire", { status: 400 });
  }

  const answers = body.answers || {};

  // Basic validation — ensure required fields are present so the PDF isn't empty.
  const visibleSections = visibleSectionsFor(q, answers);
  for (const section of visibleSections) {
    for (const f of section.fields) {
      if (!f.required) continue;
      if (!evaluateShowIf(f.showIf, answers)) continue;
      const v = answers[f.id];
      if (v === undefined || v === "") {
        return new Response(`Missing required field: ${f.label}`, {
          status: 400,
        });
      }
    }
  }

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { WeddingDayPlan } = await import("@/lib/wedding-day-plan");

  const buffer = await renderToBuffer(<WeddingDayPlan answers={answers} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Wedding-Day-Plan.pdf"',
    },
  });
}
