// POST /api/admin/update — owner-only full-record edit. Gated by the admin
// session; the record id comes from the body (admin may edit any record).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { updateClientAdmin } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  id: z.string().min(1),
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

  return NextResponse.json({ ok: true });
}
