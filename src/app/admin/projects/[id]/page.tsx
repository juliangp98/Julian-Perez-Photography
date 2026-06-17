import { redirect } from "next/navigation";
import {
  formatHumanDate as formatLongDate,
  formatRelativeDays,
  STUDIO_TIME_ZONE,
} from "@/lib/field-format";
import {
  sourceLabel,
  statusTitle,
  documentTypeLabel,
  uploaderLabel,
} from "@/lib/labels";
import { formatReferral } from "@/lib/referral";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, listClientProjectsByEmailFull } from "@/lib/clients";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import AdminProjectEditForm from "@/components/admin/AdminProjectEditForm";
import PortalBundles from "@/components/portal/PortalBundles";
import ComposeEmail from "@/components/admin/ComposeEmail";
import InquiryTriage from "@/components/admin/ai/InquiryTriage";
import PrepBrief from "@/components/admin/ai/PrepBrief";
import QuestionnaireCallout from "@/components/portal/QuestionnaireCallout";
import NextActionNudge from "@/components/admin/ai/NextActionNudge";
import { aiEnabled } from "@/lib/ai/ai";
import {
  projectDisplayName,
  autoProjectName,
  serviceNoun,
} from "@/lib/project-name";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import DeleteProjectButton from "@/components/admin/DeleteProjectButton";
import AdminCollaborators from "@/components/admin/AdminCollaborators";
import CopyField from "@/components/ui/CopyField";
import { RailCard, Detail } from "@/components/ui/RailCard";
import Panel from "@/components/ui/Panel";

export const metadata: Metadata = {
  title: "Project — Admin",
  robots: { index: false, follow: false },
};

// Admin rail field — the shared Detail with the admin list's spacing + newline
// handling, so the call sites below stay terse. RailCard is the shared one.
function Read({ label, value }: { label: string; value?: string }) {
  return <Detail label={label} value={value} className="py-2" preLine />;
}

// "June 7, 2026 · 3 days ago" for a stored timestamp, in the studio timezone
// (the server renders in UTC, which would otherwise shift evening records to
// the next day).
function stamp(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = formatLongDate(iso, { timeZone: STUDIO_TIME_ZONE });
  if (!date) return undefined;
  const rel = formatRelativeDays(iso);
  return rel ? `${date} · ${rel}` : date;
}

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");
  const { id } = await params;
  const record = await getClientFull(id);
  // Siblings (same person) — offered as bundle-link choices.
  const siblings = record?.email
    ? await listClientProjectsByEmailFull(record.email)
    : [];

  // Absolute origin for links inside prefilled emails (the client opens them
  // outside the app), and the fill context for the compose templates.
  const h = await headers();
  const host = h.get("host");
  const origin = host
    ? `${h.get("x-forwarded-proto") ?? "https"}://${host}`
    : "";
  const emailContext: Record<string, string | undefined> = record
    ? {
        firstName: record.clientName?.trim().split(/\s+/)[0],
        clientName: record.clientName,
        projectName: projectDisplayName(record),
        serviceNoun: serviceNoun(record.serviceType)?.toLowerCase(),
        eventDate: formatLongDate(record.eventDate),
        venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
        galleryUrl: record.galleryUrl,
        portalUrl: `${origin}/portal`,
        bookingUrl: `${origin}/book`,
        questionnaireUrl: record.serviceType
          ? `${origin}/questionnaire/${record.serviceType}`
          : undefined,
      }
    : {};
  const ai = aiEnabled();
  // Render the stored questionnaire JSON as readable grouped answers (falls
  // back to the raw snapshot only when it can't be parsed).
  const answerGroups = record?.questionnaireSnapshot
    ? buildAnswerGroups(record.serviceType, record.questionnaireSnapshot)
    : null;

  // A link to send the client so their questionnaire/inquiry attaches to THIS
  // project (threading the id + prefilled basics). Service known → questionnaire;
  // undecided → inquiry (which sets the service on submit).
  let completionUrl = "";
  if (record) {
    const p = new URLSearchParams({ project: record.id });
    if (record.clientName) p.set("fullName", record.clientName);
    if (record.email) p.set("email", record.email);
    if (record.phone) p.set("phone", record.phone);
    if (record.eventDate) p.set("eventDate", record.eventDate);
    completionUrl = record.serviceType
      ? `${origin}/questionnaire/${record.serviceType}?${p.toString()}`
      : `${origin}/inquire?${p.toString()}`;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <Link
        href="/admin/projects"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← All projects
      </Link>

      {!record ? (
        <div className="mt-8 p-8 border border-dashed border-[var(--border)] rounded-lg text-[var(--muted)]">
          That project couldn&rsquo;t be found.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <h1 className="font-serif text-4xl">{projectDisplayName(record)}</h1>
            {(record.clientName || record.email) && (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {[record.clientName, record.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Full-width working area: a main editing column and a context rail
              that drops below it on narrow screens. AI helpers sit with the
              data they act on. */}
          <div className="mt-8 grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-10 items-start">
            {/* ---- Main column ---- */}
            <div className="min-w-0 space-y-12">
              <div>
                <h2 className="font-serif text-2xl">Project details</h2>
                <p className="mt-2 mb-4 text-sm text-[var(--muted)]">
                  Edit contact info, status, service &amp; package, key dates,
                  the shoot plan, and internal notes.
                </p>
                <AdminProjectEditForm
                  id={record.id}
                  aiEnabled={ai}
                  namePlaceholder={autoProjectName(record)}
                  initial={{
                    projectName: record.projectName,
                    clientName: record.clientName,
                    email: record.email,
                    phone: record.phone,
                    partnerName: record.partnerName,
                    status: record.status,
                    serviceType: record.serviceType,
                    package: record.package,
                    eventDate: record.eventDate,
                    guestCount: record.guestCount,
                    budget: record.budget,
                    planSummary: record.planSummary,
                    clientNotes: record.clientNotes,
                    clientNotesReply: record.clientNotesReply,
                    internalNotes: record.internalNotes,
                    galleryUrl: record.galleryUrl,
                    locations: record.locations,
                  }}
                />
              </div>

              {/* Inquiry + its AI triage, together. */}
              {record.inquiryMessage?.trim() && (
                <div className="pt-8 border-t border-[var(--border)]">
                  <h2 className="font-serif text-2xl">Inquiry</h2>
                  <p className="mt-3 text-sm whitespace-pre-line leading-relaxed">
                    {record.inquiryMessage}
                  </p>
                  {ai && (
                    <Panel className="mt-5">
                      <h3 className="font-serif text-lg">Triage with AI</h3>
                      <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
                        Fit, urgency, key details, and a suggested reply to start
                        from.
                      </p>
                      <InquiryTriage projectId={record.id} />
                    </Panel>
                  )}
                </div>
              )}

              {/* Collapsible questionnaire read-out + its AI prep brief. The
                  callout starts collapsed (it's reference once filed); the
                  interactive prep brief sits outside it. */}
              {record.questionnaireSnapshot && (
                <div className="pt-8 border-t border-[var(--border)]">
                  <h2 className="mb-4 font-serif text-2xl">Questionnaire</h2>
                  <QuestionnaireCallout
                    groups={answerGroups}
                    rawSnapshot={record.questionnaireSnapshot}
                  />
                  {ai && record.questionnaireSnapshot.trim() && (
                    <Panel className="mt-5">
                      <h3 className="font-serif text-lg">Shoot prep brief</h3>
                      <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
                        Turn this questionnaire into a skimmable prep brief —
                        timeline, key people, must-have shots, logistics.
                      </p>
                      <PrepBrief projectId={record.id} />
                    </Panel>
                  )}
                </div>
              )}

              {/* Compose a pipeline email — prefills from this project. */}
              <div className="pt-8 border-t border-[var(--border)]">
                <h2 className="font-serif text-2xl">Compose email</h2>
                <p className="mt-2 mb-4 text-sm text-[var(--muted)]">
                  Pick a template for where this client is in the pipeline — it
                  prefills from the project. Edit, then send or copy.
                </p>
                <ComposeEmail
                  projectId={record.id}
                  hasEmail={!!record.email}
                  context={emailContext}
                  aiEnabled={ai}
                />
              </div>
            </div>

            {/* ---- Context rail ---- */}
            <aside className="min-w-0 space-y-8">
              {ai && (
                <RailCard title="Suggested next step">
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    An AI read on where this project stands and the best next
                    move.
                  </p>
                  <NextActionNudge projectId={record.id} />
                </RailCard>
              )}

              <RailCard title="Client completion link">
                <p className="mb-3 text-sm text-[var(--muted)]">
                  Send this so the client{" "}
                  {record.serviceType
                    ? "fills the planning questionnaire"
                    : "sends an inquiry that sets the service"}{" "}
                  — it attaches to this project, no duplicate.
                </p>
                <CopyField
                  label={
                    record.serviceType
                      ? "Open the questionnaire link →"
                      : "Open the inquiry link →"
                  }
                  value={completionUrl}
                  href={completionUrl}
                />
              </RailCard>

              <RailCard title="Details">
                <div className="divide-y divide-[var(--border)]">
                  <Read label="Source" value={sourceLabel(record.source)} />
                  <Read
                    label="Referral"
                    value={
                      record.referral
                        ? formatReferral(record.referral, undefined)
                        : undefined
                    }
                  />
                  {record.locations && record.locations.length > 0 && (
                    <Read
                      label="Locations"
                      value={record.locations
                        .map((l) =>
                          [l.label, l.address, l.notes]
                            .filter(Boolean)
                            .join(" — "),
                        )
                        .join("\n")}
                    />
                  )}
                  {record.secondaryDates && record.secondaryDates.length > 0 && (
                    <Read
                      label="Other dates"
                      value={record.secondaryDates
                        .map((d) =>
                          [d.label, formatLongDate(d.date) || d.date]
                            .filter(Boolean)
                            .join(": "),
                        )
                        .join("\n")}
                    />
                  )}
                  {record.documents && record.documents.length > 0 && (
                    <div className="py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Documents
                      </div>
                      <ul className="mt-1 space-y-1">
                        {record.documents.map((d, i) => (
                          <li key={i} className="text-sm">
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-4 hover:text-[var(--accent)]"
                            >
                              {d.label}
                            </a>{" "}
                            <span className="text-xs text-[var(--muted)]">
                              {[
                                documentTypeLabel(d.type),
                                uploaderLabel(d.uploadedBy),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {record.statusHistory && record.statusHistory.length > 0 && (
                    <div className="py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Status history
                      </div>
                      {/* Newest first — the latest move is what the rail is for. */}
                      <ul className="mt-1 space-y-1.5">
                        {[...record.statusHistory].reverse().map((he, i) => (
                          <li key={i} className="text-sm">
                            <div className="flex items-baseline justify-between gap-3">
                              <span>{statusTitle(he.status) || "Note"}</span>
                              {he.changedAt && (
                                <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                                  {formatLongDate(he.changedAt, {
                                    timeZone: STUDIO_TIME_ZONE,
                                  })}
                                </span>
                              )}
                            </div>
                            {he.note && (
                              <div className="text-xs text-[var(--muted)]">
                                {he.note}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Read label="Created" value={stamp(record.createdAt)} />
                  <Read label="Last updated" value={stamp(record.updatedAt)} />
                </div>
              </RailCard>

              {siblings.length >= 2 && (
                <div>
                  <h2 className="font-serif text-xl mb-3">Bundle</h2>
                  <p className="mb-3 text-sm text-[var(--muted)]">
                    Link related projects (e.g. wedding + engagement) so they show
                    grouped in the portal and here.
                  </p>
                  <PortalBundles
                    endpoint="/api/admin/bundle"
                    projects={siblings.map((s) => ({
                      id: s.id,
                      title: projectDisplayName(s),
                      bundleLabel: s.bundleLabel,
                    }))}
                  />
                </div>
              )}

              <RailCard title="Second photographer access">
                <p className="mb-4 text-sm text-[var(--muted)]">
                  Grant a second photographer read-only portal access to this
                  project — details, dates, documents, and the planning notes.
                  Per project; remove anytime.
                </p>
                <AdminCollaborators
                  projectId={record.id}
                  collaborators={record.collaborators ?? []}
                />
              </RailCard>

              <RailCard title="Danger zone" tone="danger">
                <p className="mb-4 text-sm text-[var(--muted)]">
                  Permanently remove this project and its record. This can&rsquo;t
                  be undone.
                </p>
                <DeleteProjectButton
                  projectId={record.id}
                  projectName={projectDisplayName(record)}
                />
              </RailCard>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
