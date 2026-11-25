// POST /api/admin/ai: owner-only, on demand. One route for the AI tools that
// work on a project, chosen by `kind`:
// - "triage": assesses the project's inquiry (summary, fit, urgency, key
//   details) and saves it on the project;
// - "shoot-brief": turns the planning questionnaire into a shoot-day brief and
//   saves it on the project;
// - "plan-summary": drafts the plan summary the client sees, for the owner to
//   review in the edit form (not saved here);
// - "call-guide": fits the discovery-call guide to this client and saves it;
// - "call-summary": writes up the call from the notes typed during it, with
//   suggested field updates, for the owner to edit and save (not saved here).
// None of them writes client email: Compose is the one place that's drafted.
// Answers `generated: false` when AI is off or there's nothing to work from.

export const runtime = "nodejs";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull, saveAiResult } from "@/lib/clients";
import { aiEnabled, aiModel } from "@/lib/ai/ai";
import { TriageParseError } from "@/lib/ai/assess-inquiry";
import {
  AiParseError,
  assessProjectInquiry,
  buildCallGuide,
  buildShootBrief,
  draftPlanSummary,
  summarizeCall,
} from "@/lib/ai/project-ai";
import { AI_KINDS } from "@/lib/ai-results";
import { aiBasis, callGuideBasisText } from "@/lib/ai/project-context";
import { listProjectMessages } from "@/lib/messages";
import { getAnyService } from "@/lib/content";

const schema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(AI_KINDS),
});

const none = { ok: true, generated: false };

export const POST = defineRoute({
  route: "admin/ai",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't do that right now. Try again." },
  tags: ({ kind }) => ({ model: aiModel(), kind }),
  run: async ({ projectId, kind }) => {
    if (!aiEnabled()) return none;
    const record = await getClientFull(projectId);
    if (!record) return none;

    let made;
    try {
      const at = new Date().toISOString();
      if (kind === "triage") {
        const result = await assessProjectInquiry(record);
        made = result && {
          kind,
          saved: { result, at, basis: aiBasis(record.inquiryMessage) },
        };
      } else if (kind === "shoot-brief") {
        const result = await buildShootBrief(record);
        made = result && {
          kind,
          saved: { result, at, basis: aiBasis(record.questionnaireSnapshot) },
        };
      } else if (kind === "call-guide") {
        const [messages, service] = await Promise.all([
          listProjectMessages(record.id),
          record.serviceType ? getAnyService(record.serviceType) : undefined,
        ]);
        const result = await buildCallGuide(record, messages, service);
        made = result && {
          kind,
          saved: {
            result,
            at,
            basis: aiBasis(callGuideBasisText(record, messages.at(-1)?.id)),
          },
        };
      } else if (kind === "call-summary") {
        const service = record.serviceType ? await getAnyService(record.serviceType) : undefined;
        const drafted = await summarizeCall(record, service);
        return drafted ? { ok: true, generated: true, ...drafted } : none;
      } else {
        const summary = await draftPlanSummary(record);
        return summary ? { ok: true, generated: true, summary } : none;
      }
    } catch (err) {
      if (!(err instanceof TriageParseError || err instanceof AiParseError)) throw err;
      // The model returned something unusable: a soft failure worth a retry.
      Sentry.captureException(err, {
        tags: { route: "admin/ai", stage: "parse", kind, model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the AI's answer. Try again.");
    }
    if (!made) return none;

    // Saving is half this kind's job: a failure is reported on its own, and
    // the answer isn't shown as saved when it wasn't.
    try {
      if (made.kind === "triage") await saveAiResult(record.id, "triage", made.saved);
      else if (made.kind === "shoot-brief") await saveAiResult(record.id, "shoot-brief", made.saved);
      else await saveAiResult(record.id, "call-guide", made.saved);
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "admin/ai", stage: "save", kind } });
      return apiError(502, "Couldn't save it. Try again.");
    }
    return { ok: true, generated: true, saved: made.saved };
  },
});
