// One project as a client sees it, in the order a phone shows it: the stage,
// the one next step, the stage tracker, the links and files by kind, the
// messages, the plan and details, then the questionnaire, the details they can
// edit and the upload. The portal page draws it for the client (and, narrower,
// for a second photographer, who gets a call sheet instead of the next step),
// and the admin draws it read-only for "View as client". Server-rendered.

import Link from "next/link";
import CalloutCard from "@/components/ui/CalloutCard";
import Panel from "@/components/ui/Panel";
import StageTracker from "@/components/ui/StageTracker";
import { Detail } from "@/components/ui/RailCard";
import { buttonClass } from "@/components/ui/Button";
import QuestionnaireCallout from "@/components/portal/QuestionnaireCallout";
import PortalEditForm from "@/components/portal/PortalEditForm";
import PortalDocumentUpload from "@/components/portal/PortalDocumentUpload";
import MessageThread from "@/components/messages/MessageThread";
import PortalMessageBox from "@/components/messages/PortalMessageBox";
import type { ClientRecordSafe, PortalViewerRole } from "@/lib/clients";
import type { ClientMessage } from "@/lib/messages";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  statusRank,
  type ClientStatus,
  type StageProject,
} from "@/lib/client-status";
import { formatEventDate, formatHumanDate } from "@/lib/field-format";
import { DOCUMENT_TYPES, documentTypeLabel, invoiceState, paymentMethodLabel } from "@/lib/labels";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import { projectDisplayName, autoProjectName } from "@/lib/project-name";
import { serviceTitle } from "@/lib/services-data";
import type { ClientStep } from "@/lib/next-step";

type Props = {
  record: ClientRecordSafe;
  viewerRole: PortalViewerRole;
  messages: ClientMessage[];
  // What the stage tracker reads (listStageFacts).
  stage: StageProject;
  // The client's next step (none for a second photographer or a closed project).
  next?: ClientStep;
  // The date hold running, if any.
  holdUntil?: string;
  // The how-to-pay line for the method chosen.
  paymentLine?: string;
  // The questionnaire (prefilled) or, with no service yet, the inquiry.
  questionnaireUrl?: string;
  inquireUrl?: string;
  // Who a second photographer calls on the day.
  dayOfContact: string;
  aiEnabled: boolean;
  // The owner looking at the client's page: read-only, with a banner.
  preview?: boolean;
};

// A button-styled link out of the site, or within it.
function StepLink({ step, primary }: { step: NonNullable<ClientStep["action"]>; primary: boolean }) {
  const cls = buttonClass(primary ? "primary" : "secondary", "md");
  return step.external ? (
    <a href={step.href} target="_blank" rel="noreferrer" className={cls}>
      {step.label}
    </a>
  ) : (
    <Link href={step.href} className={cls}>
      {step.label}
    </Link>
  );
}

function NextStepCard({ step }: { step: ClientStep }) {
  return (
    <section aria-label="Your next step">
      <Panel tone="accent" className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Your next step</div>
        <p className="font-serif text-2xl">{step.title}</p>
        {step.detail && <p className="text-sm text-muted">{step.detail}</p>}
        {(step.action || step.secondary) && (
          <div className="flex flex-wrap gap-3 pt-1">
            {step.action && <StepLink step={step.action} primary />}
            {step.secondary && <StepLink step={step.secondary} primary={false} />}
          </div>
        )}
      </Panel>
    </section>
  );
}

// The project's links and files, grouped by kind in the order the kinds are
// listed (proposal, contract, invoices, timeline, highlights, gallery, ...).
function LinksByKind({ documents }: { documents: NonNullable<ClientRecordSafe["documents"]> }) {
  const kinds = [
    ...DOCUMENT_TYPES.map((t) => t.value),
    ...new Set(documents.map((d) => d.type ?? "other").filter((t) => !DOCUMENT_TYPES.some((k) => k.value === t))),
  ];
  const groups = kinds
    .map((kind) => ({ kind, items: documents.filter((d) => (d.type ?? "other") === kind) }))
    .filter((g) => g.items.length);
  return (
    <section aria-labelledby="links-heading">
      <h2 id="links-heading" className="font-serif text-2xl">
        Links &amp; files
      </h2>
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g.kind}>
            <h3 className="text-xs uppercase tracking-[0.18em] text-muted">{documentTypeLabel(g.kind) || "Files"}</h3>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-white">
              {g.items.map((doc, i) => (
                <li key={doc.id ?? i}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm transition hover:text-accent"
                  >
                    <span>
                      {doc.label}
                      {doc.type === "invoice" && <span className="block text-xs text-muted">{invoiceState(doc)}</span>}
                    </span>
                    <span aria-hidden className="text-xs text-muted">
                      &#8599;
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// What a second photographer needs on the day, in one place.
function CallSheet({ record, dayOfContact }: { record: ClientRecordSafe; dayOfContact: string }) {
  const when = formatEventDate(record.eventDate);
  const people = [record.clientName, record.partnerName].filter(Boolean).join(" and ");
  const timelines = (record.documents ?? []).filter((d) => d.type === "timeline");
  return (
    <section aria-labelledby="call-sheet-heading">
      <Panel className="space-y-5">
        <h2 id="call-sheet-heading" className="font-serif text-2xl">
          Call sheet
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="When" value={when || "Date to be set"} />
          <Detail label="Who" value={[people, record.guestCount != null ? `${record.guestCount} guests` : ""].filter(Boolean).join(", ")} />
          <Detail label="Day-of contact" value={`Julian, ${dayOfContact}`} />
          {record.secondaryDates && record.secondaryDates.length > 0 && (
            <Detail
              label="Other dates"
              value={record.secondaryDates.map((d) => [d.label, formatHumanDate(d.date) || d.date].filter(Boolean).join(": ")).join("\n")}
              preLine
            />
          )}
        </div>
        {record.locations && record.locations.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Where</div>
            <ul className="mt-2 space-y-3">
              {record.locations.map((l, i) => (
                <li key={i} className="text-sm">
                  {l.label && <div className="font-medium">{l.label}</div>}
                  {l.address && <div className="whitespace-pre-line text-muted">{l.address}</div>}
                  {l.notes && <div className="text-muted">{l.notes}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Timeline</div>
          {timelines.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {timelines.map((t, i) => (
                <li key={t.id ?? i}>
                  <a href={t.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-accent">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Not shared yet.</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

export default function PortalProjectView({
  record,
  viewerRole,
  messages,
  stage,
  next,
  holdUntil,
  paymentLine,
  questionnaireUrl,
  inquireUrl,
  dayOfContact,
  aiEnabled,
  preview = false,
}: Props) {
  const isCollaborator = viewerRole === "collaborator";
  const clientLabel = CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ?? "In progress";
  // Before a proposal, the plan isn't settled yet: the page shows the next
  // step and the messages, not the plan.
  const proposed = statusRank(record.status) >= statusRank("proposal-sent");
  const shown = (record.documents ?? []).filter((d) => !isCollaborator || d.type !== "timeline");
  const answerGroups = record.questionnaireSnapshot
    ? buildAnswerGroups(record.serviceType, record.questionnaireSnapshot)
    : null;
  const submitted = (!!answerGroups && answerGroups.length > 0) || !!record.questionnaireSnapshot?.trim();
  const facts = [
    record.serviceType && { label: "Service", value: serviceTitle(record.serviceType) ?? "" },
    record.package && { label: "Package", value: record.package },
    formatEventDate(record.eventDate) && { label: "Event date", value: formatEventDate(record.eventDate) },
    record.guestCount != null && { label: "Guest count", value: String(record.guestCount) },
    record.partnerName && { label: "Partner", value: record.partnerName },
    holdUntil && { label: "Date held until", value: formatHumanDate(holdUntil) },
    record.paymentMethod && { label: "Paying by", value: paymentMethodLabel(record.paymentMethod) },
  ].filter((f): f is { label: string; value: string } => !!f && !!f.value);

  return (
    <>
      <h1 className="mt-4 font-serif text-4xl">{projectDisplayName(record)}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent">
          {clientLabel}
        </span>
        {record.bundleLabel && (
          <span className="inline-block rounded-full border border-accent px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent">
            ↔ {record.bundleLabel}
          </span>
        )}
      </div>

      {(isCollaborator || preview) && (
        <div className="mt-6 rounded-lg border border-accent/40 bg-accent/[0.04] px-5 py-3 text-sm text-muted">
          {preview ? (
            <>
              <span className="font-medium text-foreground">Viewing as the client</span> This is their page,
              read-only. Nothing here sends or saves.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Shared with you</span> You have
              second-photographer access to this project. Everything here is view-only.
            </>
          )}
        </div>
      )}

      <div className="mt-8 max-w-4xl space-y-10">
        {!isCollaborator && next && <NextStepCard step={next} />}

        <StageTracker project={stage} />

        {isCollaborator && <CallSheet record={record} dayOfContact={dayOfContact} />}

        {!isCollaborator && inquireUrl && (
          <CalloutCard
            eyebrow="Tell me what you're planning"
            title="Set up your service"
            description="You started this project without picking a service. Send a quick note and I'll get it set up. It stays attached to this project."
            actions={preview ? [] : [{ label: "Tell me what you're thinking →", href: inquireUrl }]}
          />
        )}

        {/* A second photographer's timeline is on the call sheet already. */}
        {shown.length > 0 && <LinksByKind documents={shown} />}

        {!isCollaborator && (
          <section aria-labelledby="messages-heading">
            <h2 id="messages-heading" className="font-serif text-2xl">
              Messages
            </h2>
            <p className="mt-2 mb-5 text-sm text-muted">
              Everything we&rsquo;ve written each other about this project. Write here, or just reply to
              any of my emails.
            </p>
            <MessageThread messages={messages} viewer="client" clientLabel={record.clientName || "You"} />
            {!preview && (
              <PortalMessageBox
                projectId={record.id}
                aiEnabled={aiEnabled}
                service={serviceTitle(record.serviceType)}
                assistContext={{
                  clientName: record.clientName,
                  details: [
                    { label: "Event date", value: record.eventDate ?? "" },
                    { label: "Project status", value: clientLabel },
                    { label: "Project name", value: record.projectName ?? "" },
                    { label: "Partner name", value: record.partnerName ?? "" },
                  ].filter((d) => d.value),
                }}
              />
            )}
          </section>
        )}

        {(facts.length > 0 || (proposed && record.planSummary)) && !isCollaborator && (
          <section aria-labelledby="plan-heading">
            <h2 id="plan-heading" className="font-serif text-2xl">
              {proposed && record.planSummary ? "Your plan" : "At a glance"}
            </h2>
            {proposed && record.planSummary && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {record.planSummary}
              </p>
            )}
            {facts.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {facts.map((f) => (
                  <Detail key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            )}
            {paymentLine && <p className="mt-4 text-sm text-muted">{paymentLine}</p>}
            {record.locations && record.locations.length > 0 && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Locations</div>
                <ul className="mt-2 space-y-3">
                  {record.locations.map((l, i) => (
                    <li key={i} className="text-sm">
                      {l.label && <div className="font-medium">{l.label}</div>}
                      {l.address && <div className="whitespace-pre-line text-muted">{l.address}</div>}
                      {l.notes && <div className="text-muted">{l.notes}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {isCollaborator ? (
          answerGroups && answerGroups.length > 0 ? (
            <QuestionnaireCallout groups={answerGroups} defaultOpen title="Planning details" />
          ) : (
            <p className="text-sm text-muted">
              The client hasn&rsquo;t sent their planning questionnaire yet. Their answers about the shoot
              appear here once they do.
            </p>
          )
        ) : (
          questionnaireUrl && (
            <QuestionnaireCallout
              groups={answerGroups}
              description="Fill it out so I show up prepared. Your details here carry over, and anything you add goes straight back to this project."
              action={
                preview
                  ? undefined
                  : {
                      label: submitted
                        ? "Resubmit to update →"
                        : `Open your ${serviceTitle(record.serviceType) ?? ""} questionnaire →`,
                      href: questionnaireUrl,
                    }
              }
            />
          )
        )}

        {!isCollaborator && !preview && (
          <>
            <section aria-labelledby="details-heading">
              <h2 id="details-heading" className="font-serif text-2xl">
                Update your details
              </h2>
              <p className="mt-2 mb-5 text-sm text-muted">
                Keep your contact info current. I&rsquo;ll see any changes you make here.
              </p>
              <PortalEditForm
                projectId={record.id}
                namePlaceholder={autoProjectName(record)}
                initial={{
                  phone: record.phone,
                  partnerName: record.partnerName,
                  guestCount: record.guestCount,
                  projectName: record.projectName,
                }}
              />
            </section>
            <section aria-labelledby="upload-heading">
              <h2 id="upload-heading" className="font-serif text-2xl">
                Upload a document
              </h2>
              <p className="mt-2 mb-4 text-sm text-muted">
                Share anything useful: a venue floor plan, a timeline, an inspiration PDF. I&rsquo;ll see it
                attached to this project.
              </p>
              <PortalDocumentUpload projectId={record.id} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
