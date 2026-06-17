// POST /api/admin/collaborators — grant or revoke a second photographer's
// per-project READ access to the portal. Add can optionally email the
// collaborator a one-click sign-in link. Admin-gated; writes go through the
// data-layer helpers that keep the collaborators array + the queryable
// collaborator_emails index in lockstep.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import {
  addCollaborator,
  removeCollaborator,
  getClientById,
} from "@/lib/clients";
import { projectDisplayName } from "@/lib/project-name";
import { signMagicToken } from "@/lib/auth";
import { sendCollaboratorInviteEmail } from "@/lib/email/notify";
import * as Sentry from "@sentry/nextjs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    projectId: z.string().min(1),
    email: z.string().email(),
    name: z.string().max(120).optional(),
    sendInvite: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("remove"),
    projectId: z.string().min(1),
    email: z.string().email(),
  }),
]);

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const limited = rateLimitResponse(req, {
    key: "admin-collaborators",
    max: 30,
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

  try {
    if (parsed.data.action === "remove") {
      await removeCollaborator(parsed.data.projectId, parsed.data.email);
      return NextResponse.json({ ok: true });
    }

    const { projectId, email, name, sendInvite } = parsed.data;
    await addCollaborator(projectId, { email, name });

    if (sendInvite) {
      // Fire-and-forget: a failed invite must not fail the grant itself.
      try {
        const record = await getClientById(projectId);
        const projectName = record
          ? projectDisplayName(record)
          : "your shared project";
        const token = await signMagicToken({ email });
        const origin =
          req.headers.get("origin") || new URL(req.url).origin;
        const inviteLink = `${origin}/portal/verify?token=${encodeURIComponent(token)}`;
        await sendCollaboratorInviteEmail({ to: email, projectName, inviteLink });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "admin-collaborators", stage: "invite" },
          level: "warning",
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin] collaborators error:", err);
    Sentry.captureException(err, { tags: { route: "admin-collaborators" } });
    return NextResponse.json(
      { error: "Couldn't update — please try again." },
      { status: 500 },
    );
  }
}
