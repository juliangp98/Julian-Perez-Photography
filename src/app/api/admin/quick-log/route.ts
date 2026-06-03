// POST /api/admin/quick-log — owner adds a status-history note and/or changes
// status on a project straight from the projects overview, without opening the
// full record.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { addAdminLog } from "@/lib/clients";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
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

  return NextResponse.json({ ok: true });
}
