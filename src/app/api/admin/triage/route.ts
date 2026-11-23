// POST /api/admin/triage — owner-only. Reads a project's inquiry server-side and
// returns an AI assessment to help Julian prioritize and respond: a short
// summary, a fit verdict, an urgency read, the key details worth capturing, and
// a suggested reply in his voice. New inquiries arrive pre-assessed in the
// owner email; this button re-runs the assessment on demand (never on page
// load) against the record as it stands now.
//
// No-ops gracefully (`triaged: false`) when AI isn't configured, the project
// can't be resolved, or it has no inquiry to assess — the admin UI then simply
// doesn't show an assessment.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { aiEnabled, aiModel } from "@/lib/ai/ai";
import { assessInquiry, TriageParseError } from "@/lib/ai/triage";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-triage",
    max: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!aiEnabled()) {
    return NextResponse.json({ ok: true, triaged: false });
  }

  const record = await getClientFull(parsed.data.projectId);
  if (!record?.inquiryMessage?.trim()) {
    // Nothing to triage (no record, or no inquiry text on it).
    return NextResponse.json({ ok: true, triaged: false });
  }

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

    if (!triage) {
      return NextResponse.json({ ok: true, triaged: false });
    }
    return NextResponse.json({ ok: true, triaged: true, triage });
  } catch (err) {
    if (err instanceof TriageParseError) {
      // The model returned something unusable — treat as a soft failure.
      Sentry.captureException(err, {
        tags: { route: "admin-triage", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the assessment — please try again." },
        { status: 502 },
      );
    }
    console.error("[admin] triage error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-triage", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't triage right now — please try again." },
      { status: 502 },
    );
  }
}
