// POST /api/admin/collaborators: owner-only. Grants or revokes a second
// photographer's read access to one project's portal; an add can also email a
// sign-in link, and a failed invite never fails the grant.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { defineRoute, originOf } from "@/lib/api-route";
import {
  addCollaborator,
  removeCollaborator,
  getClientById,
} from "@/lib/clients";
import { projectDisplayName } from "@/lib/project-name";
import { signMagicToken } from "@/lib/auth";
import { sendCollaboratorInviteEmail } from "@/lib/email/notify";

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

export const POST = defineRoute({
  route: "admin/collaborators",
  auth: "admin",
  schema,
  rateLimit: { max: 30, windowMs: 60_000 },
  failure: { status: 500, error: "Couldn't update. Try again." },
  run: async (data, { req }) => {
    if (data.action === "remove") {
      await removeCollaborator(data.projectId, data.email);
      return { ok: true };
    }

    const { projectId, email, name, sendInvite } = data;
    await addCollaborator(projectId, { email, name });

    if (sendInvite) {
      // Fire-and-forget: a failed invite must not fail the grant itself.
      try {
        const record = await getClientById(projectId);
        const projectName = record
          ? projectDisplayName(record)
          : "your shared project";
        const token = await signMagicToken({ email });
        const inviteLink = `${originOf(req)}/portal/verify?token=${encodeURIComponent(token)}`;
        await sendCollaboratorInviteEmail({ to: email, projectName, inviteLink });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "admin/collaborators", stage: "invite" },
          level: "warning",
        });
      }
    }
    return { ok: true };
  },
});
