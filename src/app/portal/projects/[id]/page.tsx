import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { getProjectForEmail } from "@/lib/clients";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import { getQuestionnaire } from "@/lib/questionnaires";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import PortalEditForm from "@/components/PortalEditForm";
import PortalDocumentUpload from "@/components/PortalDocumentUpload";
import PortalStatusTimeline from "@/components/PortalStatusTimeline";
import SubNav, { CLIENT_TABS } from "@/components/SubNav";
import CalloutCard from "@/components/CalloutCard";
import QuestionnaireCallout from "@/components/QuestionnaireCallout";
import { RailCard, Detail } from "@/components/RailCard";
import { projectDisplayName, autoProjectName } from "@/lib/project-name";
import { serviceTitle } from "@/lib/services-data";
import { aiEnabled } from "@/lib/ai";

// One project view. Renders ONLY the client-safe projection and is gated to the
// signed-in person's email (getProjectForEmail), so a client can never open a
// project id that isn't theirs.
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};

function questionnaireLinkFor(record: {
  id: string;
  serviceType?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  partnerName?: string;
  eventDate?: string;
  guestCount?: number;
}): { href: string } | null {
  if (!record.serviceType) return null;
  const q = getQuestionnaire(record.serviceType);
  if (!q) return null;
  const params = new URLSearchParams();
  // Attach the submission to THIS project (not a fresh email+service match).
  params.set("project", record.id);
  if (record.clientName) params.set("fullName", record.clientName);
  if (record.email) params.set("email", record.email);
  if (record.phone) params.set("phone", record.phone);
  if (record.partnerName) params.set("partnerFullName", record.partnerName);
  if (record.eventDate) params.set("eventDate", record.eventDate);
  if (record.guestCount != null) params.set("guestCount", String(record.guestCount));
  return { href: `/questionnaire/${record.serviceType}?${params.toString()}` };
}

function formatDate(d?: string): string | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/portal");
  const { id } = await params;
  const record = await getProjectForEmail(id, session.email);
  if (!record) {
    return (
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
        <Link
          href="/portal/dashboard"
          className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Your projects
        </Link>
        <h1 className="mt-4 font-serif text-3xl">Project not found</h1>
        <p className="mt-3 text-[var(--muted)]">
          That project isn&rsquo;t on your account. Head back to your projects.
        </p>
      </section>
    );
  }

  const link = questionnaireLinkFor(record);
  // The client's own questionnaire answers (owner-gated snapshot), grouped for
  // the collapsible read-out — null until something's been submitted.
  const answerGroups = record.questionnaireSnapshot
    ? buildAnswerGroups(record.serviceType, record.questionnaireSnapshot)
    : null;
  const questionnaireSubmitted =
    (!!answerGroups && answerGroups.length > 0) ||
    !!record.questionnaireSnapshot?.trim();
  // A service-undecided project (created without a service) has no questionnaire
  // yet — point the client at the inquiry, threaded so it attaches here.
  const inquireParams = new URLSearchParams({ project: record.id });
  if (record.email) inquireParams.set("email", record.email);
  if (record.clientName) inquireParams.set("fullName", record.clientName);
  if (record.phone) inquireParams.set("phone", record.phone);
  const inquireLink = !record.serviceType
    ? `/inquire?${inquireParams.toString()}`
    : null;
  const hasOtherDates = !!record.secondaryDates && record.secondaryDates.length > 0;
  const hasLocations = !!record.locations && record.locations.length > 0;
  const hasGlance =
    !!record.serviceType ||
    !!record.package ||
    !!formatDate(record.eventDate) ||
    record.guestCount != null ||
    !!record.partnerName ||
    !!record.budget ||
    hasOtherDates ||
    hasLocations;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
      <Link
        href="/portal/dashboard"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← Your projects
      </Link>

      <h1 className="mt-4 font-serif text-4xl">{projectDisplayName(record)}</h1>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs uppercase tracking-[0.18em]">
          {CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ??
            "In progress"}
        </span>
        {record.bundleLabel && (
          <span className="inline-block px-3 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)] text-xs uppercase tracking-[0.18em]">
            ↔ {record.bundleLabel}
          </span>
        )}
      </div>

      <PortalStatusTimeline status={record.status} eventDate={record.eventDate} />

      {/* Prominent CTAs span the full width. */}
      {record.galleryUrl && (
        <a
          href={record.galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/[0.04] p-5 hover:bg-[var(--accent)]/[0.08] transition"
        >
          <div>
            <div className="font-serif text-xl">Your gallery is ready</div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              View and download your photos.
            </div>
          </div>
          <span className="px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm whitespace-nowrap">
            View gallery →
          </span>
        </a>
      )}

      {/* Updates & submissions (left) + static project info (right rail). */}
      <div className="mt-10 grid lg:grid-cols-[1.6fr_1fr] gap-x-12 gap-y-10 items-start">
        <div className="min-w-0 space-y-10">
          {inquireLink && (
            <CalloutCard
              eyebrow="Tell me what you're planning"
              title="Set up your service"
              description="You started this project without picking a service. Send a quick note and I'll get it set up — it stays attached to this project."
              actions={[
                { label: "Tell me what you're thinking →", href: inquireLink },
              ]}
            />
          )}

          <div>
            <h2 className="font-serif text-2xl">Update your details</h2>
            <p className="mt-2 mb-5 text-sm text-[var(--muted)]">
              Keep your contact info and notes current — I&rsquo;ll see any
              changes you make here.
            </p>
            <PortalEditForm
              projectId={record.id}
              namePlaceholder={autoProjectName(record)}
              aiEnabled={aiEnabled()}
              projectContext={{
                clientName: record.clientName,
                service: serviceTitle(record.serviceType),
                eventDate: record.eventDate,
                status:
                  CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus],
              }}
              initial={{
                phone: record.phone,
                partnerName: record.partnerName,
                guestCount: record.guestCount,
                clientNotes: record.clientNotes,
                clientNotesReply: record.clientNotesReply,
                projectName: record.projectName,
              }}
            />
          </div>

          <div>
            <h2 className="font-serif text-2xl">Upload a document</h2>
            <p className="mt-2 mb-4 text-sm text-[var(--muted)]">
              Share anything useful — a venue floor plan, a timeline, an
              inspiration PDF. I&rsquo;ll see it attached to this project.
            </p>
            <PortalDocumentUpload projectId={record.id} />
          </div>
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
                {record.budget && (
                  <Detail label="Budget" value={record.budget} />
                )}
              </div>

              {hasOtherDates && (
                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Other dates
                  </div>
                  <ul className="mt-2 divide-y divide-[var(--border)]">
                    {record.secondaryDates!.map((d, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-4 py-2.5 text-sm first:pt-0"
                      >
                        <span>{d.label ?? "Date"}</span>
                        <span className="text-[var(--muted)]">
                          {formatDate(d.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasLocations && (
                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Locations
                  </div>
                  <div className="mt-3 space-y-4">
                    {record.locations!.map((l, i) => (
                      <div
                        key={i}
                        className={
                          i > 0 ? "border-t border-[var(--border)] pt-4" : ""
                        }
                      >
                        {l.label && (
                          <div className="text-sm font-medium">{l.label}</div>
                        )}
                        {l.address && (
                          <div className="mt-1 whitespace-pre-line text-sm text-[var(--muted)]">
                            {l.address}
                          </div>
                        )}
                        {l.notes && (
                          <div className="mt-1 text-sm text-[var(--muted)]">
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
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--foreground)]/90">
                {record.planSummary}
              </p>
            </RailCard>
          )}

          {/* Planning questionnaire — collapsed once submitted (shows your own
              answers + resubmit), open as a prompt when not yet started. Only
              for service-set projects; the service-undecided inquiry prompt
              lives in the left column. */}
          {link && (
            <QuestionnaireCallout
              groups={answerGroups}
              description="Fill it out so I show up fully prepared — your details here are carried over, and anything you add flows straight back to this project."
              action={{
                label: questionnaireSubmitted
                  ? "Resubmit to update →"
                  : `Open your ${serviceTitle(record.serviceType)} questionnaire →`,
                href: link.href,
              }}
            />
          )}

          {record.documents && record.documents.length > 0 && (
            <RailCard title="Documents">
              <ul className="divide-y divide-[var(--border)]">
                {record.documents.map((doc, i) => (
                  <li key={i}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex justify-between items-baseline py-2.5 gap-4 text-sm hover:text-[var(--accent)] transition first:pt-0"
                    >
                      <span>{doc.label}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] whitespace-nowrap">
                        {doc.type ?? "file"} &#8599;
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
