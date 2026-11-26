// What a client's project page shows, worked out once for the two places that
// draw it: the client's portal page, and the owner's "View as client". The
// record is the client-safe projection (or a second photographer's narrower
// one); the stage tracker's facts come from listStageFacts, which lets only
// those facts out of the owner-side columns. Server-only.

import "server-only";
import { listStageFacts, type ClientRecordSafe, type PortalViewerRole } from "@/lib/clients";
import { listProjectMessages, listSentEmails } from "@/lib/messages";
import { shootStage, type StageProject } from "@/lib/client-status";
import { getSiteSettings } from "@/lib/content";
import { heldUntil } from "@/lib/email/send-effects";
import { studioToday } from "@/lib/field-format";
import { planningCallFor, projectLinks } from "@/lib/project-links";
import { clientNextStep } from "@/lib/next-step";
import { aiEnabled } from "@/lib/ai/ai";
import type { PaymentMethod } from "@/lib/labels";

// The stage facts for the projects a person is shown in the portal, the
// project page's and the dashboard's: a client's read with the emails sent on
// their projects (whether the date is still being reserved), a second
// photographer's narrowed to the shoot (shootStage).
export async function portalStageFacts(
  projects: { id: string; viewerRole: PortalViewerRole }[],
): Promise<Map<string, StageProject>> {
  const owned = projects.filter((p) => p.viewerRole === "owner").map((p) => p.id);
  const facts = await listStageFacts(
    projects.map((p) => p.id),
    await listSentEmails(owned),
  );
  for (const p of projects) {
    const f = facts.get(p.id);
    if (f && p.viewerRole !== "owner") facts.set(p.id, shootStage(f));
  }
  return facts;
}

export async function clientViewProps(record: ClientRecordSafe, viewerRole: PortalViewerRole) {
  const today = studioToday();
  const [settings, messages, facts] = await Promise.all([
    getSiteSettings(),
    // A second photographer doesn't see the client's thread.
    viewerRole === "owner" ? listProjectMessages(record.id, { clientView: true }) : Promise.resolve([]),
    portalStageFacts([{ id: record.id, viewerRole }]),
  ]);
  // In-app links (no origin): the prefilled questionnaire, or the inquiry for
  // a project with no service yet.
  const links = projectLinks(record, "");
  const hold = heldUntil(record, undefined, today);
  const paymentLine = record.paymentMethod
    ? settings.paymentInstructions[record.paymentMethod as PaymentMethod]
    : undefined;
  const stage = facts.get(record.id) ?? (viewerRole === "owner" ? { status: record.status } : shootStage(record));
  const next =
    viewerRole === "owner"
      ? clientNextStep({ ...record, reserving: stage.reserving }, {
          today,
          holdUntil: hold?.until,
          questionnaireUrl: links.questionnaireUrl,
          discoveryCallUrl: settings.calls.discoveryCall.url,
          planningCall: planningCallFor(record.serviceType, settings.calls),
          reviewUrl: settings.googleProfileUrl,
          paymentLine,
        })
      : undefined;
  return {
    record,
    viewerRole,
    messages,
    stage,
    next,
    holdUntil: hold?.until,
    paymentLine,
    questionnaireUrl: links.questionnaireUrl,
    inquireUrl: links.inquireUrl,
    dayOfContact: settings.contactEmail,
    aiEnabled: aiEnabled(),
  };
}
