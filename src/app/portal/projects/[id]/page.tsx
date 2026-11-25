import { redirect } from "next/navigation";
import { formatHumanDate as formatDate, studioToday } from "@/lib/field-format";
import { heldUntil } from "@/lib/email/send-effects";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { getProjectForViewer } from "@/lib/clients";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import { projectLinks } from "@/lib/project-links";
import {
  documentTypeLabel,
  invoiceState,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/labels";
import { getSiteSettings } from "@/lib/content";
import PortalEditForm from "@/components/portal/PortalEditForm";
import PortalDocumentUpload from "@/components/portal/PortalDocumentUpload";
import PortalStatusTimeline from "@/components/portal/PortalStatusTimeline";
import SubNav, { CLIENT_TABS } from "@/components/ui/SubNav";
import CalloutCard from "@/components/ui/CalloutCard";
import QuestionnaireCallout from "@/components/portal/QuestionnaireCallout";
import { RailCard, Detail } from "@/components/ui/RailCard";
import { projectDisplayName, autoProjectName } from "@/lib/project-name";
import { serviceTitle } from "@/lib/services-data";
import { aiEnabled } from "@/lib/ai/ai";
import { listProjectMessages } from "@/lib/messages";
import MessageThread from "@/components/messages/MessageThread";
import PortalMessageBox from "@/components/messages/PortalMessageBox";

// One project view. Renders ONLY the client-safe projection and is gated to the
// signed-in person's email (getProjectForViewer), so a client can never open a
// project id that isn't theirs. A second photographer gets a narrower read.
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};


export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/portal");
  const { id } = await params;
  const viewer = await getProjectForViewer(id, session.email);
  if (!viewer) {
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
        <Link
          href="/portal/dashboard"
          className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground"
        >
          ← Your projects
        </Link>
        <h1 className="mt-4 font-serif text-3xl">Project not found</h1>
        <p className="mt-3 text-muted">
          That project isn&rsquo;t on your account. Head back to your projects.
        </p>
      </section>
    );
  }
  const { record, viewerRole } = viewer;
  // A second photographer granted read access: everything is view-only, and
  // the client's message thread isn't theirs to see.
  const isCollaborator = viewerRole === "collaborator";
  const messages = isCollaborator
    ? []
    : await listProjectMessages(record.id, { clientView: true });

  // In-app links (no origin): the questionnaire for a set service, the inquiry
  // for an undecided one, and the gallery once Julian has added it.
  const links = projectLinks(record, "");
  // A date hold that's running (none once the date is being reserved).
  const hold = heldUntil(record, undefined, studioToday());
  // The how-to-pay line for the method this client is using. A second
  // photographer's read carries no payment method, so they get none.
  const paymentLine = record.paymentMethod
    ? (await getSiteSettings()).paymentInstructions[
        record.paymentMethod as PaymentMethod
      ]
    : undefined;
  // The questionnaire answers this viewer may read (the client's own in full; a
  // second photographer's without the booking questions), grouped for the
  // collapsible read-out — null until something's been submitted.
  const answerGroups = record.questionnaireSnapshot
    ? buildAnswerGroups(record.serviceType, record.questionnaireSnapshot)
    : null;
  const questionnaireSubmitted =
    (!!answerGroups && answerGroups.length > 0) ||
    !!record.questionnaireSnapshot?.trim();
  // A service-undecided project (created without a service) has no questionnaire
  // yet — point the client at the inquiry, threaded so it attaches here.
  const inquireLink = links.inquireUrl;
  const hasOtherDates = !!record.secondaryDates && record.secondaryDates.length > 0;
  const hasLocations = !!record.locations && record.locations.length > 0;
  const hasGlance =
    !!record.serviceType ||
    !!record.package ||
    !!formatDate(record.eventDate) ||
    record.guestCount != null ||
    !!record.partnerName ||
    !!record.paymentMethod ||
    !!hold ||
    hasOtherDates ||
    hasLocations;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
      <Link
        href="/portal/dashboard"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground"
      >
        ← Your projects
      </Link>

      <h1 className="mt-4 font-serif text-4xl">{projectDisplayName(record)}</h1>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs uppercase tracking-[0.18em]">
          {CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ??
            "In progress"}
        </span>
        {record.bundleLabel && (
          <span className="inline-block px-3 py-1 rounded-full border border-accent text-accent text-xs uppercase tracking-[0.18em]">
            ↔ {record.bundleLabel}
          </span>
        )}
      </div>

      {isCollaborator && (
        <div className="mt-6 rounded-lg border border-accent/40 bg-accent/[0.04] px-5 py-3 text-sm text-muted">
          <span className="font-medium text-foreground">
            Shared with you
          </span>{" "}
          You have second-photographer access to this project. Everything here
          is view-only.
        </div>
      )}

      <PortalStatusTimeline status={record.status} eventDate={record.eventDate} />

      {/* Prominent CTAs span the full width. */}
      {links.galleryUrl && (
        <a
          href={links.galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-accent bg-accent/[0.04] p-5 hover:bg-accent/[0.08] transition"
        >
          <div>
            <div className="font-serif text-xl">Your gallery is ready</div>
            <div className="mt-1 text-sm text-muted">
              View and download your photos.
            </div>
          </div>
          <span className="px-5 py-2 bg-foreground text-background rounded-full text-sm whitespace-nowrap">
            View gallery →
          </span>
        </a>
      )}

      {/* Updates & submissions (left) + static project info (right rail). */}
      <div className="mt-10 grid lg:grid-cols-[1.6fr_1fr] gap-x-12 gap-y-10 items-start">
        <div className="min-w-0 space-y-10">
          {isCollaborator ? (
            // Read-only left column for a second photographer: the couple's
            // planning answers get the wide column (the most useful thing for a
            // shoot collaborator). No edit/upload affordances.
            answerGroups && answerGroups.length > 0 ? (
              <div>
                <h2 className="font-serif text-2xl">Planning details</h2>
                <p className="mt-2 mb-5 text-sm text-muted">
                  The couple&rsquo;s questionnaire answers: shot priorities,
                  timeline, must-haves.
                </p>
                <QuestionnaireCallout
                  groups={answerGroups}
                  defaultOpen
                  title="Planning questionnaire"
                />
              </div>
            ) : (
              <p className="text-sm text-muted">
                The couple hasn&rsquo;t submitted their planning questionnaire
                yet. Their details will appear here once they do.
              </p>
            )
          ) : (
            <>
              {inquireLink && (
                <CalloutCard
                  eyebrow="Tell me what you're planning"
                  title="Set up your service"
                  description="You started this project without picking a service. Send a quick note and I'll get it set up. It stays attached to this project."
                  actions={[
                    {
                      label: "Tell me what you're thinking →",
                      href: inquireLink,
                    },
                  ]}
                />
              )}

              <div>
                <h2 className="font-serif text-2xl">Messages</h2>
                <p className="mt-2 mb-5 text-sm text-muted">
                  Everything we&rsquo;ve written each other about this project.
                  Write here, or just reply to any of my emails.
                </p>
                <MessageThread
                  messages={messages}
                  viewer="client"
                  clientLabel={record.clientName || "You"}
                />
                <PortalMessageBox
                  projectId={record.id}
                  aiEnabled={aiEnabled()}
                  service={serviceTitle(record.serviceType)}
                  assistContext={{
                    clientName: record.clientName,
                    details: [
                      { label: "Event date", value: record.eventDate ?? "" },
                      {
                        label: "Project status",
                        value: CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ?? "",
                      },
                      { label: "Project name", value: record.projectName ?? "" },
                      { label: "Partner name", value: record.partnerName ?? "" },
                    ].filter((d) => d.value),
                  }}
                />
              </div>

              <div>
                <h2 className="font-serif text-2xl">Update your details</h2>
                <p className="mt-2 mb-5 text-sm text-muted">
                  Keep your contact info current. I&rsquo;ll see any changes
                  you make here.
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
              </div>

              <div>
                <h2 className="font-serif text-2xl">Upload a document</h2>
                <p className="mt-2 mb-4 text-sm text-muted">
                  Share anything useful: a venue floor plan, a timeline, an
                  inspiration PDF. I&rsquo;ll see it attached to this project.
                </p>
                <PortalDocumentUpload projectId={record.id} />
              </div>
            </>
          )}
        </div>

        <aside className="min-w-0 space-y-8">
          {hasGlance && (
            <RailCard title="At a glance">
              <div className="grid grid-cols-2 gap-4">
                {record.serviceType && (
                  <Detail
                    label="Service"
                    value={serviceTitle(record.serviceType)}
                  />
                )}
                {record.package && (
                  <Detail label="Package" value={record.package} />
                )}
                {formatDate(record.eventDate) && (
                  <Detail
                    label="Event date"
                    value={formatDate(record.eventDate)!}
                  />
                )}
                {record.guestCount != null && (
                  <Detail label="Guest count" value={String(record.guestCount)} />
                )}
                {record.partnerName && (
                  <Detail label="Partner" value={record.partnerName} />
                )}
                {hold && <Detail label="Date held until" value={formatDate(hold.until)} />}
                {record.paymentMethod && (
                  <Detail
                    label="Paying by"
                    value={paymentMethodLabel(record.paymentMethod)}
                  />
                )}
              </div>
              {paymentLine && (
                <p className="mt-4 text-sm text-muted">{paymentLine}</p>
              )}

              {hasOtherDates && (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted">
                    Other dates
                  </div>
                  <ul className="mt-2 divide-y divide-border">
                    {record.secondaryDates!.map((d, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-4 py-2.5 text-sm first:pt-0"
                      >
                        <span>{d.label ?? "Date"}</span>
                        <span className="text-muted">
                          {formatDate(d.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasLocations && (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted">
                    Locations
                  </div>
                  <div className="mt-3 space-y-4">
                    {record.locations!.map((l, i) => (
                      <div
                        key={i}
                        className={
                          i > 0 ? "border-t border-border pt-4" : ""
                        }
                      >
                        {l.label && (
                          <div className="text-sm font-medium">{l.label}</div>
                        )}
                        {l.address && (
                          <div className="mt-1 whitespace-pre-line text-sm text-muted">
                            {l.address}
                          </div>
                        )}
                        {l.notes && (
                          <div className="mt-1 text-sm text-muted">
                            {l.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </RailCard>
          )}

          {record.planSummary && (
            <RailCard title="Plan">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {record.planSummary}
              </p>
            </RailCard>
          )}

          {/* Planning questionnaire — collapsed once submitted (shows your own
              answers + resubmit), open as a prompt when not yet started. Only
              for service-set projects; the service-undecided inquiry prompt
              lives in the left column. Collaborators see the read-out in the
              left column instead (no resubmit). */}
          {!isCollaborator && links.questionnaireUrl && (
            <QuestionnaireCallout
              groups={answerGroups}
              description="Fill it out so I show up prepared. Your details here carry over, and anything you add goes straight back to this project."
              action={{
                label: questionnaireSubmitted
                  ? "Resubmit to update →"
                  : `Open your ${serviceTitle(record.serviceType)} questionnaire →`,
                href: links.questionnaireUrl,
              }}
            />
          )}

          {record.documents && record.documents.length > 0 && (
            <RailCard title="Links & files">
              <ul className="divide-y divide-border">
                {record.documents.map((doc, i) => (
                  <li key={doc.id ?? i}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex justify-between items-baseline py-2.5 gap-4 text-sm hover:text-accent transition first:pt-0"
                    >
                      <span>
                        {doc.label}
                        {doc.type === "invoice" && (
                          <span className="block text-xs text-muted">
                            {invoiceState(doc)}
                          </span>
                        )}
                      </span>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted whitespace-nowrap">
                        {documentTypeLabel(doc.type) || "File"} &#8599;
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </RailCard>
          )}
        </aside>
      </div>
    </section>
  );
}
