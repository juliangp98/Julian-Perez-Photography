// The project's Call tab (server-rendered): what Julian needs in front of him
// for a discovery call that takes no AI (the facts in one line, how warm the
// lead is, whether the date is free, the service's collections), then the
// guide itself (DiscoveryCall).

import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import DiscoveryCall from "@/components/admin/DiscoveryCall";
import { listClients, type ClientRecordFull } from "@/lib/clients";
import { getAnyService } from "@/lib/content";
import { discoveryGuide } from "@/lib/discovery-guides";
import { formatHumanDate, studioToday } from "@/lib/field-format";
import { formatReferral } from "@/lib/referral";
import { projectDisplayName } from "@/lib/project-name";
import { CLIENT_STATUS_TERMINAL, statusRank, type ClientStatus } from "@/lib/client-status";
import { heldUntil } from "@/lib/email/send-effects";
import { triageVerdict, type TriageFit } from "@/lib/triage";
import { aiBasis, callGuideBasisText, isCurrent } from "@/lib/ai/project-context";

const FIT_TONE: Record<TriageFit, BadgeTone> = { good: "good", maybe: "warn", poor: "muted" };

// Who else has this date: projects booked on it, and leads holding it.
async function dateCheck(record: ClientRecordFull): Promise<string[] | null> {
  const day = record.eventDate?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const today = studioToday();
  const others = (await listClients()).filter((p) => p.id !== record.id && p.eventDate?.trim() === day);
  const lines: string[] = [];
  for (const p of others) {
    if (CLIENT_STATUS_TERMINAL.includes(p.status as ClientStatus)) continue;
    if (statusRank(p.status) >= statusRank("booked")) {
      lines.push(`Booked: ${projectDisplayName(p)}`);
      continue;
    }
    const hold = heldUntil(p, undefined, today);
    if (hold) {
      lines.push(`Held for ${p.clientName?.split(" ")[0] || "another lead"} until ${formatHumanDate(hold.until)}`);
    }
  }
  return lines;
}

export default async function CallTab({
  record,
  newestMessageId,
  ai,
}: {
  record: ClientRecordFull;
  newestMessageId?: string;
  ai: boolean;
}) {
  const [service, taken] = await Promise.all([
    record.serviceType ? getAnyService(record.serviceType) : undefined,
    dateCheck(record),
  ]);
  const guide = discoveryGuide(record.serviceType);
  const venue = record.locations?.[0]?.label || record.locations?.[0]?.address;
  const facts = [
    formatHumanDate(record.eventDate) || "No date yet",
    venue,
    record.guestCount != null ? `${record.guestCount} guests` : undefined,
    record.budget ? `Budget ${record.budget}` : undefined,
    record.referral ? `Found you: ${formatReferral(record.referral, undefined)}` : undefined,
  ].filter(Boolean);
  const contact = [record.email, record.phone].filter(Boolean).join(" · ");

  const triage = record.aiResults?.triage;
  const triageCurrent = isCurrent(triage, record.inquiryMessage);
  const tailoring = record.aiResults?.["call-guide"];
  const tailoringCurrent =
    !tailoring || !tailoring.basis || tailoring.basis === aiBasis(callGuideBasisText(record, newestMessageId));

  return (
    <div className="mt-8 space-y-8">
      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted">
            {guide.family.label} call
          </span>
          {triage && triageCurrent && (
            <Badge tone={FIT_TONE[triage.result.fit]}>{triageVerdict(triage.result)}</Badge>
          )}
        </div>
        <p className="text-sm">{facts.join(" · ")}</p>
        {contact && <p className="text-sm text-muted">{contact}</p>}
        {taken && (
          <p className={`text-sm ${taken.length ? "text-danger" : "text-muted"}`}>
            {taken.length
              ? `This date: ${taken.join("; ")}.`
              : "Nothing else is booked or held on this date."}
          </p>
        )}
        {service && (
          <details>
            <summary className="cursor-pointer text-sm underline underline-offset-4">
              {service.title} collections
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {service.packages.map((p) => (
                <li key={p.name}>
                  <span className="font-medium">{p.name}</span>: {p.price}
                  {p.duration ? `, ${p.duration}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">
              {[
                service.retainerPercent != null ? `Retainer ${service.retainerPercent}%` : undefined,
                service.holdDays ? `date held ${service.holdDays} days` : undefined,
              ]
                .filter(Boolean)
                .join(", ") || "Retainer and hold days aren't set for this service in Studio yet."}
            </p>
            {service.sampleGalleryUrl && (
              <a
                href={service.sampleGalleryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm underline underline-offset-4 hover:text-accent"
              >
                Sample gallery
              </a>
            )}
          </details>
        )}
      </Panel>

      <DiscoveryCall
        projectId={record.id}
        guide={guide}
        tailoring={tailoring}
        tailoringStale={!tailoringCurrent}
        call={record.calls?.discovery}
        canRun={ai}
        locations={record.locations}
      />
    </div>
  );
}
