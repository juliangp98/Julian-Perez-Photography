import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, listClientProjectsByEmailFull } from "@/lib/clients";
import SubNav, { ADMIN_TABS } from "@/components/SubNav";
import AdminProjectEditForm from "@/components/AdminProjectEditForm";
import PortalBundles from "@/components/PortalBundles";
import ComposeEmail from "@/components/ComposeEmail";
import InquiryTriage from "@/components/InquiryTriage";
import PrepBrief from "@/components/PrepBrief";
import QuestionnaireCallout from "@/components/QuestionnaireCallout";
import NextActionNudge from "@/components/NextActionNudge";
import { aiEnabled } from "@/lib/ai";
import {
  projectDisplayName,
  autoProjectName,
  serviceNoun,
} from "@/lib/project-name";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import CopyField from "@/components/CopyField";
import { RailCard, Detail } from "@/components/RailCard";

export const metadata: Metadata = {
  title: "Project — Admin",
  robots: { index: false, follow: false },
};

// "June 7, 2026" from an event-date string; leaves the raw value if unparseable,
// undefined if absent — used to prefill email templates.
function formatLongDate(d?: string): string | undefined {
  if (!d) return undefined;
  let date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Admin rail field — the shared Detail with the admin list's spacing + newline
// handling, so the call sites below stay terse. RailCard is the shared one.
function Read({ label, value }: { label: string; value?: string }) {
  return <Detail label={label} value={value} className="py-2" preLine />;
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
                    <div className="mt-5 rounded-lg border border-[var(--border)] bg-white p-5">
                      <h3 className="font-serif text-lg">Triage with AI</h3>
                      <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
                        Fit, urgency, key details, and a suggested reply to start
                        from.
                      </p>
                      <InquiryTriage projectId={record.id} />
                    </div>
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
                    <div className="mt-5 rounded-lg border border-[var(--border)] bg-white p-5">
                      <h3 className="font-serif text-lg">Shoot prep brief</h3>
                      <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
                        Turn this questionnaire into a skimmable prep brief —
                        timeline, key people, must-have shots, logistics.
                      </p>
                      <PrepBrief projectId={record.id} />
                    </div>
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
                  <Read label="Source" value={record.source} />
                  <Read label="Referral" value={record.referral} />
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
                        .map((d) => [d.label, d.date].filter(Boolean).join(": "))
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
                              ({d.type}, {d.uploadedBy})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {record.statusHistory && record.statusHistory.length > 0 && (
                    <Read
                      label="Status history"
                      value={record.statusHistory
                        .map(
                          (he) =>
                            `${he.status}${he.note ? ` — ${he.note}` : ""}${
                              he.changedAt
                                ? ` (${new Date(he.changedAt).toLocaleDateString()})`
                                : ""
                            }`,
                        )
                        .join("\n")}
                    />
                  )}
                  <Read label="Created" value={record.createdAt} />
                  <Read label="Last updated" value={record.updatedAt} />
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
