// POST /api/admin/ai: owner-only, on demand. One route for the AI tools that
// work on a project, chosen by `kind`:
// - "triage": assesses the project's inquiry (summary, fit, urgency, key
//   details) and saves it on the project;
// - "shoot-brief": turns the planning questionnaire into a shoot-day brief and
//   saves it on the project;
// - "plan-summary": drafts the plan summary the client sees, for the owner to
//   review in the edit form (not saved here).
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
  buildShootBrief,
  draftPlanSummary,
} from "@/lib/ai/project-ai";
import { AI_KINDS } from "@/lib/ai-results";

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
  tags: () => ({ model: aiModel() }),
  run: async ({ projectId, kind }) => {
    if (!aiEnabled()) return none;
    const record = await getClientFull(projectId);
    if (!record) return none;

    try {
      const at = new Date().toISOString();
      if (kind === "triage") {
        const result = await assessProjectInquiry(record);
        if (!result) return none;
        const saved = { result, at };
        await saveAiResult(record.id, "triage", saved);
        return { ok: true, generated: true, saved };
      }
      if (kind === "shoot-brief") {
        const result = await buildShootBrief(record);
        if (!result) return none;
        const saved = { result, at };
        await saveAiResult(record.id, "shoot-brief", saved);
        return { ok: true, generated: true, saved };
      }
      const summary = await draftPlanSummary(record);
      return summary ? { ok: true, generated: true, summary } : none;
    } catch (err) {
      if (!(err instanceof TriageParseError || err instanceof AiParseError)) throw err;
      // The model returned something unusable: a soft failure worth a retry.
      Sentry.captureException(err, {
        tags: { route: "admin/ai", stage: "parse", kind, model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the AI's answer. Try again.");
    }
  },
});
