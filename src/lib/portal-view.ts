// What a client's project page shows, worked out once for the two places that
// draw it: the client's portal page, and the owner's "View as client". The
// record is the client-safe projection (or a second photographer's narrower
// one); the stage tracker's facts come from listStageFacts, which lets only
// those facts out of the owner-side columns. Server-only.

import "server-only";
import { listStageFacts, type ClientRecordSafe, type PortalViewerRole } from "@/lib/clients";
import { listProjectMessages } from "@/lib/messages";
import { getSiteSettings } from "@/lib/content";
import { heldUntil } from "@/lib/email/send-effects";
import { studioToday } from "@/lib/field-format";
import { projectLinks } from "@/lib/project-links";
import { clientNextStep } from "@/lib/next-step";
import { aiEnabled } from "@/lib/ai/ai";
import type { PaymentMethod } from "@/lib/labels";

// Services whose planning call is the wedding timeline call.
const TIMELINE_CALL_SERVICES = new Set(["weddings", "wedding-films"]);

export async function clientViewProps(record: ClientRecordSafe, viewerRole: PortalViewerRole) {
  const today = studioToday();
  const [settings, messages, facts] = await Promise.all([
    getSiteSettings(),
    // A second photographer doesn't see the client's thread.
    viewerRole === "owner" ? listProjectMessages(record.id, { clientView: true }) : Promise.resolve([]),
    listStageFacts([record.id]),
  ]);
  // In-app links (no origin): the prefilled questionnaire, or the inquiry for
  // a project with no service yet.
  const links = projectLinks(record, "");
  const hold = heldUntil(record, undefined, today);
  const paymentLine = record.paymentMethod
    ? settings.paymentInstructions[record.paymentMethod as PaymentMethod]
    : undefined;
  const timelineCall = TIMELINE_CALL_SERVICES.has(record.serviceType ?? "")
    ? settings.calls.weddingTimelineCall.url
    : settings.calls.planningCall.url;
  const next =
    viewerRole === "owner"
      ? clientNextStep(record, {
          today,
          holdUntil: hold?.until,
          questionnaireUrl: links.questionnaireUrl,
          discoveryCallUrl: settings.calls.discoveryCall.url,
          timelineCallUrl: timelineCall,
          reviewUrl: settings.googleProfileUrl,
          paymentLine,
        })
      : undefined;
  return {
    record,
    viewerRole,
    messages,
    stage: facts.get(record.id) ?? { status: record.status },
    next,
    holdUntil: hold?.until,
    paymentLine,
    questionnaireUrl: links.questionnaireUrl,
    inquireUrl: links.inquireUrl,
    dayOfContact: settings.contactEmail,
    aiEnabled: aiEnabled(),
  };
}
