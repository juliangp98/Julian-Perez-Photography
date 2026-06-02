// POST /api/admin/bundle — owner links/unlinks projects into a bundle. The
// link helper enforces that all projects belong to one person (same email), so
// a bundle can never span two clients.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { setBundleAdmin, clearBundleAdmin } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    projectIds: z.array(z.string().min(1)).min(2).max(20),
    label: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("unlink"), projectId: z.string().min(1) }),
]);

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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "link") {
      await setBundleAdmin(parsed.data.projectIds, parsed.data.label);
    } else {
      await clearBundleAdmin(parsed.data.projectId);
    }
  } catch (err) {
    console.error("[admin] bundle error:", err);
    Sentry.captureException(err, { tags: { route: "admin-bundle" } });
    return NextResponse.json(
      { error: "Couldn't update — please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
