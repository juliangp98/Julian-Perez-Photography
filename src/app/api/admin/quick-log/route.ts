// POST /api/admin/quick-log — owner adds a status-history note and/or changes
// status on a project straight from the projects overview, without opening the
// full record.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { addAdminLog, getClientFull } from "@/lib/clients";
import {
  CLIENT_STATUS_OPTIONS,
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import { projectDisplayName } from "@/lib/project-name";
import { sendClientUpdateEmail } from "@/lib/notify";
import * as Sentry from "@sentry/nextjs";

const STATUS_VALUES = CLIENT_STATUS_OPTIONS.map((s) => s.value) as [
  string,
  ...string[],
];

const schema = z
  .object({
    projectId: z.string().min(1),
    status: z.enum(STATUS_VALUES).optional(),
    note: z.string().max(500).optional(),
    notifyClient: z.boolean().optional(),
  })
  .refine((d) => !!d.status || !!d.note?.trim(), {
    message: "Provide a status change or a note.",
  });

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await addAdminLog(parsed.data.projectId, {
      status: parsed.data.status,
      note: parsed.data.note,
    });
  } catch (err) {
    console.error("[admin] quick-log error:", err);
    Sentry.captureException(err, { tags: { route: "admin-quick-log" } });
    return NextResponse.json(
      { error: "Couldn't save — please try again." },
      { status: 500 },
    );
  }

  // Optional: notify the client (admin opt-in). The internal note is never
  // shared — only a high-level "there's an update", with the new status label.
  if (parsed.data.notifyClient) {
    try {
      const record = await getClientFull(parsed.data.projectId);
      if (record?.email) {
        const origin = req.headers.get("origin") || new URL(req.url).origin;
        const name = projectDisplayName(record);
        const statusLabel = parsed.data.status
          ? CLIENT_STATUS_CLIENT_LABEL[parsed.data.status as ClientStatus]
          : undefined;
        await sendClientUpdateEmail({
          to: record.email,
          firstName: record.clientName?.split(" ")[0],
          projectName: name,
          portalUrl: `${origin}/portal`,
          lines: statusLabel
            ? [
                `There's an update on ${name} — it's now marked "${statusLabel}".`,
                "Sign in to your portal to see the latest.",
              ]
            : [
                `There's a new update on ${name}.`,
                "Sign in to your portal to see the latest.",
              ],
        });
      }
    } catch (err) {
      console.error("[admin] quick-log notify error:", err);
      Sentry.captureException(err, {
        tags: { route: "admin-quick-log", stage: "notify" },
        level: "warning",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
