// POST /api/portal/messages: a signed-in client writes on their project's
// thread from the portal. The message is filed on the thread and forwarded to
// the owner's inbox, where replying answers the client by email.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth-cookies";
import { getProjectForViewer } from "@/lib/clients";
import { recordMessage } from "@/lib/messages";
import { forwardToOwner } from "@/lib/email/relay";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";

const schema = z.object({
  projectId: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(5000),
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const limited = rateLimitResponse(req, { key: "portal-messages", max: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }
  if (isHoneypotTriggered(parsed.data.hp_company)) return NextResponse.json({ ok: true });

  // Owners only: a second photographer can read the project but not the thread.
  const viewer = await getProjectForViewer(parsed.data.projectId, session.email);
  if (!viewer || viewer.viewerRole !== "owner") {
    return NextResponse.json({ error: "That project isn't on your account." }, { status: 404 });
  }
  const { record } = viewer;

  try {
    await recordMessage({
      projectId: record.id,
      direction: "in",
      channel: "portal",
      kind: "portal",
      fromAddr: session.email,
      bodyText: parsed.data.body,
      status: "received",
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "portal/messages", stage: "record" } });
    return NextResponse.json({ error: "Couldn't send. Try again." }, { status: 500 });
  }

  try {
    await forwardToOwner(record, {
      from: session.email,
      subject: `New message on ${record.projectName || record.clientName || "your project"}`,
      body: parsed.data.body,
      origin: new URL(req.url).origin,
      viaPortal: true,
    });
  } catch (err) {
    // The message is on the thread either way; the owner sees it there.
    Sentry.captureException(err, {
      tags: { route: "portal/messages", stage: "forward" },
      level: "warning",
    });
  }
  return NextResponse.json({ ok: true });
}
