// POST /api/portal/update: client-portal field edits. The caller must own the
// project; the zod schema is the whitelist, so status, package, pricing, and
// internal fields are never editable here.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { render } from "@react-email/components";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { updateClientFields, getProjectForEmail } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
} from "@/lib/email/email-templates";
import { clientEditNotifyEnabled } from "@/lib/email/notify";
import { sendEmail } from "@/lib/email/send";

const schema = z.object({
  projectId: z.string().min(1),
  phone: z.string().max(50).optional(),
  partnerName: z.string().max(200).optional(),
  guestCount: z.coerce.number().int().min(0).max(100000).optional(),
  projectName: z.string().max(200).optional(),
});

export const POST = defineRoute({
  route: "portal/update",
  auth: "portal",
  schema,
  rateLimit: { max: 20, windowMs: 10 * 60 * 1000 },
  invalid: "Please check the form and try again.",
  failure: { status: 500, error: "Couldn't save right now. Try again." },
  run: async ({ projectId, ...fields }, { req, session }) => {
    // Ownership gate: the project must belong to the signed-in person.
    const owned = await getProjectForEmail(projectId, session.email);
    if (!owned) return apiError(404, "Not found.");

    await updateClientFields(projectId, fields);

    // Notify the owner (fire-and-forget) so the change gets reviewed.
    try {
      if (clientEditNotifyEnabled()) {
        const settings = await getSiteSettings();
        const to = process.env.INQUIRY_TO || settings.contactEmail;
        const origin = originOf(req);
        const html = await render(
          BrandedEmailLayout({
            preview: "A client updated their portal details",
            children: NotificationEmailTemplate({
              heading: "Client details updated",
              lines: [
                `${session.email} just updated their details in the client portal.`,
                "Open the admin dashboard to review the change.",
              ],
              cta: { label: "Open admin →", href: `${origin}/admin/projects` },
            }),
          }),
        );
        await sendEmail({
          to,
          subject: `Client updated their details — ${session.email}`,
          html,
          text: `${session.email} updated their portal details. Review it in your admin dashboard: ${origin}/admin/projects`,
        });
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "portal/update", stage: "notify" },
        level: "warning",
      });
    }

    return { ok: true };
  },
});
