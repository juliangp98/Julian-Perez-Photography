// POST /api/admin/triage: owner-only, on demand. Assesses a project's inquiry
// as it stands (summary, fit, urgency, key details) with the same assessment the
// inquiry route runs on every new inquiry. It writes no reply; the compose panel
// is the one place client emails are drafted.

export const runtime = "nodejs";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { aiEnabled, aiModel } from "@/lib/ai/ai";
import { assessInquiry, TriageParseError } from "@/lib/ai/assess-inquiry";

const schema = z.object({
  projectId: z.string().min(1),
});

export const POST = defineRoute({
  route: "admin/triage",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't triage right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, triaged: false };

    const record = await getClientFull(data.projectId);
    // Nothing to triage (no record, or no inquiry text on it).
    if (!record?.inquiryMessage?.trim()) return { ok: true, triaged: false };

    try {
      const triage = await assessInquiry({
        serviceType: record.serviceType,
        clientName: record.clientName,
        eventDate: record.eventDate,
        budget: record.budget,
        guestCount: record.guestCount,
        venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
        referral: record.referral,
        message: record.inquiryMessage,
      });
      return triage ? { ok: true, triaged: true, triage } : { ok: true, triaged: false };
    } catch (err) {
      if (!(err instanceof TriageParseError)) throw err;
      // The model returned something unusable: a soft failure worth a retry.
      Sentry.captureException(err, {
        tags: { route: "admin/triage", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the assessment. Try again.");
    }
  },
});
