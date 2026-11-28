// The daily job (vercel.json): one query against the client store so the
// Supabase free tier never pauses, settle thread messages whose delivery event
// never arrived, email the owner the day's Today list (once a studio day, on
// days with something on it), and re-check the AI models against the
// provider's catalogue.

export const runtime = "nodejs";
// Every run must reach Postgres to count as activity.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { pingClientsStore, isClientsStoreConfigured } from "@/lib/clients";
import { reconcileUnsettledSends } from "@/lib/email/relay";
import { sendMorningEmail } from "@/lib/morning-email";
import { aiEnabled, refreshAiModels } from "@/lib/ai/ai";

export async function GET(req: Request) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Without a secret the
  // route only runs outside production, so a misconfigured deploy can't be
  // triggered by anyone.
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // No store configured (e.g. a fresh clone) — nothing to keep alive.
  if (!isClientsStoreConfigured()) {
    return NextResponse.json({ ok: true, skipped: "store-unconfigured" });
  }

  let count: number;
  try {
    count = await pingClientsStore();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "cron/keepalive", stage: "ping" },
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Settle thread messages whose delivery webhook never arrived.
  let settled = 0;
  try {
    settled = await reconcileUnsettledSends();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "cron/keepalive", stage: "reconcile" },
      level: "warning",
    });
  }
  // The morning email, after the delivery check: a send it settles as bounced
  // puts a reply or inquiry row back on the list. Before the model check,
  // which can email the owner too.
  let morning: string;
  try {
    morning = await sendMorningEmail();
  } catch (err) {
    // Reported once, here; a failed send has given the day back already.
    Sentry.captureException(err, {
      tags: { route: "cron/keepalive", stage: "morning-email" },
      level: "warning",
    });
    morning = "failed";
  }
  // Re-choose the AI models from the live catalogue (the owner hears if they change).
  let models: string | undefined;
  if (aiEnabled()) {
    try {
      models = (await refreshAiModels("daily check")).primary;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "cron/keepalive", stage: "ai-models" },
        level: "warning",
      });
    }
  }
  return NextResponse.json({ ok: true, count, settled, morning, models });
}
