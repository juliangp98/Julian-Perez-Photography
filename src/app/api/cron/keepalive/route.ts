export const runtime = "nodejs";
// Never cache — every invocation must reach Postgres for the ping to count as
// activity.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { pingClientsStore, isClientsStoreConfigured } from "@/lib/clients";

// Keep-alive endpoint for the Supabase free tier, which auto-pauses a project
// after ~7 days without database activity. The public site reads almost
// entirely from Sanity, so Postgres can sit idle for long stretches between
// admin/portal sessions. A daily Vercel Cron (see vercel.json) hits this route,
// which runs one trivial count against `client_records` — enough to reset the
// idle timer. Vercel automatically attaches `Authorization: Bearer $CRON_SECRET`
// to scheduled invocations, so the guard below rejects anything else when the
// secret is set; with no secret configured the route is open but harmless (it
// only ever reads a count).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // No store configured (e.g. a fresh clone) — nothing to keep alive.
  if (!isClientsStoreConfigured()) {
    return NextResponse.json({ ok: true, skipped: "store-unconfigured" });
  }

  try {
    const count = await pingClientsStore();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "cron/keepalive", stage: "ping" },
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
