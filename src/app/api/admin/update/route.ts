// POST /api/admin/update — owner-only full-record edit. Gated by the admin
// session; the record id comes from the body (admin may edit any record).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { updateClientAdmin, getClientFull } from "@/lib/clients";
import { projectDisplayName } from "@/lib/project-name";
import { sendClientUpdateEmail, summarizeClientChanges } from "@/lib/notify";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  id: z.string().min(1),
  notifyClient: z.boolean().optional(),
  fields: z.object({
    clientName: z.string().max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    partnerName: z.string().max(200).optional(),
    status: z.string().max(50).optional(),
    serviceType: z.string().max(100).optional(),
    package: z.string().max(200).optional(),
    eventDate: z.string().max(100).optional(),
    guestCount: z.coerce.number().int().min(0).max(1000000).optional(),
    budget: z.string().max(100).optional(),
    planSummary: z.string().max(10000).optional(),
    internalNotes: z.string().max(10000).optional(),
    galleryUrl: z.string().max(2000).optional(),
    projectName: z.string().max(200).optional(),
    // Julian's reply to the client's notes/questions (shown to the client).
    // The client's own `clientNotes` are not admin-writable.
    clientNotesReply: z.string().max(10000).optional(),
  }),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  // Snapshot the record before the write so the client email can describe what
  // actually changed (only fetched when a notification is requested).
  const before = parsed.data.notifyClient
    ? await getClientFull(parsed.data.id)
    : null;

  try {
    await updateClientAdmin(parsed.data.id, parsed.data.fields);
  } catch (err) {
    console.error("[admin] update error:", err);
    Sentry.captureException(err, { tags: { route: "admin-update" } });
    return NextResponse.json(
      { error: "Couldn't save — please try again." },
      { status: 500 },
    );
  }

  // Optional: notify the client their project was updated (admin opt-in). The
  // email lists the specific changes (status, date, package, …) — never the
  // internal note, budget, or raw service slug.
  if (parsed.data.notifyClient && before?.email) {
    try {
      const f = parsed.data.fields;
      const origin = req.headers.get("origin") || new URL(req.url).origin;
      // Name from the post-update view (a renamed/redated project reads right).
      const name = projectDisplayName({
        projectName: f.projectName ?? before.projectName,
        clientName: f.clientName ?? before.clientName,
        serviceType: f.serviceType ?? before.serviceType,
        eventDate: f.eventDate ?? before.eventDate,
      });
      const changes = summarizeClientChanges(before, f);
      await sendClientUpdateEmail({
        to: before.email,
        firstName: (f.clientName ?? before.clientName)?.split(" ")[0],
        projectName: name,
        portalUrl: `${origin}/portal`,
        lines: changes.length
          ? [`Here's the latest on ${name}:`]
          : [
              `There's a new update on ${name}.`,
              "Sign in to your portal to see the latest.",
            ],
        changes,
      });
    } catch (err) {
      console.error("[admin] update notify error:", err);
      Sentry.captureException(err, {
        tags: { route: "admin-update", stage: "notify" },
        level: "warning",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
