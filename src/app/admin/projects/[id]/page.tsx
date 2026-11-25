import { redirect } from "next/navigation";
import {
  formatHumanDate as formatLongDate,
  formatStamp,
  STUDIO_TIME_ZONE,
} from "@/lib/field-format";
import { DOCUMENT_TYPES, sourceLabel, statusTitle } from "@/lib/labels";
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
import { projectDisplayName, autoProjectName } from "@/lib/project-name";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import { emailTokens } from "@/lib/email/email-tokens";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";
import { heldUntil, planSendEffects, type SendEffectsPlan } from "@/lib/email/send-effects";
import { getAnyService } from "@/lib/content";
import { studioToday } from "@/lib/field-format";
import { projectLink, projectLinks } from "@/lib/project-links";
import DeleteProjectButton from "@/components/admin/DeleteProjectButton";
import AdminCollaborators from "@/components/admin/AdminCollaborators";
import AdminProjectLinks from "@/components/admin/AdminProjectLinks";
import CopyField from "@/components/ui/CopyField";
import { RailCard, Detail } from "@/components/ui/RailCard";
import Panel from "@/components/ui/Panel";
import MessageThread from "@/components/messages/MessageThread";
import { listProjectMessages, ensureReplyToken } from "@/lib/messages";
import { triageSteer } from "@/lib/triage";
import { isCurrent } from "@/lib/ai/project-context";
import { logAddress } from "@/lib/email/inbound";

export const metadata: Metadata = {
  title: "Project · Admin",
  robots: { index: false, follow: false },
};

// Admin rail field: Detail with the admin list's spacing and newline handling.
function Read({ label, value }: { label: string; value?: string }) {
  return <Detail label={label} value={value} className="py-2" preLine />;
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // ?compose=<template id>: triage, next-step suggestions and links open the
  // compose panel on a template. A link's "Tell the client" adds &doc=<entry
  // id>, and the assessment's "Draft a reply" adds &v=<when it was made>; both
  // only tell one hand-off from the next. No client detail rides in the
  // address: the inquiry reply is steered from the saved assessment.
  searchParams: Promise<{ compose?: string; doc?: string; v?: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");
  const { id } = await params;
  const { compose, doc, v } = await searchParams;
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
  const emailContext = record ? await emailTokens(record, origin) : {};
  // What sending each template would do to this project today, for Compose to
  // say before sending and to name the hold a proposal starts.
  const today = studioToday();
  const service = record?.serviceType ? await getAnyService(record.serviceType) : undefined;
  const sendPlans: Record<string, SendEffectsPlan> = record
    ? Object.fromEntries(
        EMAIL_TEMPLATES.map((t) => [
          t.id,
          planSendEffects(t, record, { today, holdDays: service?.holdDays }),
        ]),
      )
    : {};
  const runningHold = record ? heldUntil(record, undefined, today) : undefined;
  // The saved AI results, and whether each was made from what the project
  // holds now (the inquiry it assessed, the answers it briefed).
  const savedTriage = record?.aiResults?.triage;
  const triageCurrent = isCurrent(savedTriage, record?.inquiryMessage);
  const savedBrief = record?.aiResults?.["shoot-brief"];
  const briefCurrent = isCurrent(savedBrief, record?.questionnaireSnapshot);
  const ai = aiEnabled();
  const [messages, replyToken] = record
    ? await Promise.all([listProjectMessages(record.id), ensureReplyToken(record.id)])
    : [[], null];
  const filingAddress = replyToken ? logAddress(replyToken) : undefined;
  // Render the stored questionnaire JSON as readable grouped answers (falls
  // back to the raw snapshot only when it can't be parsed).
  const answerGroups = record?.questionnaireSnapshot
    ? buildAnswerGroups(record.serviceType, record.questionnaireSnapshot)
    : null;

  // A link to send the client so their questionnaire/inquiry attaches to THIS
  // project, prefilled with what's known. Service known → its questionnaire;
  // undecided → the inquiry (which sets the service on submit). A service with
  // no questionnaire has neither.
  const links = record ? projectLinks(record, origin) : null;
  const completionUrl = links?.questionnaireUrl ?? links?.inquireUrl;
  // The link a Compose template would carry for each kind that has a template:
  // the entries that offer "Tell the client".
  const announceIds = record
    ? DOCUMENT_TYPES.filter((t) => t.template)
        .map((t) => projectLink(record, t.value)?.id)
        .filter((id): id is string => !!id)
    : [];

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <Link
        href="/admin/projects"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground"
      >
        ← All projects
      </Link>

      {!record ? (
        <div className="mt-8 p-8 border border-dashed border-border rounded-lg text-muted">
          That project couldn&rsquo;t be found.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <h1 className="font-serif text-4xl">{projectDisplayName(record)}</h1>
            {(record.clientName || record.email) && (
              <p className="mt-1 text-sm text-muted">
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
                <p className="mt-2 mb-4 text-sm text-muted">
                  Edit contact info, status, service &amp; package, how they
                  pay, key dates, the shoot plan, and internal notes.
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
                    internalNotes: record.internalNotes,
                    paymentMethod: record.paymentMethod,
                    locations: record.locations,
                  }}
                />
              </div>

              {/* Inquiry + its AI triage, together. */}
              {record.inquiryMessage?.trim() && (
                <div className="pt-8 border-t border-border">
                  <h2 className="font-serif text-2xl">Inquiry</h2>
                  <p className="mt-3 text-sm whitespace-pre-line leading-relaxed">
                    {record.inquiryMessage}
                  </p>
                  {(ai || savedTriage) && (
                    <Panel className="mt-5">
                      <h3 className="font-serif text-lg">Assessment</h3>
                      <p className="mt-1 mb-4 text-sm text-muted">
                        Fit, urgency and key details from the inquiry, with a
                        link to draft the reply in Compose.
                      </p>
                      <InquiryTriage
                        projectId={record.id}
                        saved={savedTriage}
                        stale={!!savedTriage && !triageCurrent}
                        canRun={ai}
                      />
                    </Panel>
                  )}
                </div>
              )}

              {/* Collapsible questionnaire read-out + its AI prep brief. The
                  callout starts collapsed (it's reference once filed); the
                  interactive prep brief sits outside it. */}
              {record.questionnaireSnapshot && (
                <div className="pt-8 border-t border-border">
                  <h2 className="mb-4 font-serif text-2xl">Questionnaire</h2>
                  <QuestionnaireCallout
                    groups={answerGroups}
                    rawSnapshot={record.questionnaireSnapshot}
                  />
                  {(ai || savedBrief) &&
                    record.questionnaireSnapshot.trim() && (
                    <Panel className="mt-5">
                      <h3 className="font-serif text-lg">Shoot prep brief</h3>
                      <p className="mt-1 mb-4 text-sm text-muted">
                        Turn this questionnaire into a skimmable prep brief:
                        timeline, key people, must-have shots, logistics.
                      </p>
                      <PrepBrief
                        projectId={record.id}
                        saved={savedBrief}
                        stale={!!savedBrief && !briefCurrent}
                        canRun={ai}
                      />
                    </Panel>
                  )}
                </div>
              )}

              <div className="pt-8 border-t border-border">
                <h2 className="font-serif text-2xl">Messages</h2>
                <p className="mt-2 mb-4 text-sm text-muted">
                  Every email to and from this client, with delivery status.
                  Replies land here and in your inbox.
                </p>
                <MessageThread
                  messages={messages}
                  viewer="owner"
                  clientLabel={record.clientName || record.email || "Client"}
                />
                {filingAddress && (
                  <div className="mt-4">
                    <CopyField
                      label="To file an older email here, forward it from Gmail to"
                      value={filingAddress}
                    />
                  </div>
                )}
              </div>

              {/* Compose a pipeline email; it prefills from this project. */}
              <div id="compose" className="pt-8 border-t border-border scroll-mt-24">
                <h2 className="font-serif text-2xl">Compose email</h2>
                <p className="mt-2 mb-4 text-sm text-muted">
                  Pick a template for where this client is in the pipeline. It
                  prefills from the project. Edit, then send or copy.
                </p>
                <ComposeEmail
                  key={`${compose ?? ""}|${doc ?? ""}|${v ?? ""}`}
                  initialTemplateId={compose}
                  initialSteer={
                    compose === "inquiry-reply" && savedTriage && triageCurrent
                      ? triageSteer(savedTriage.result)
                      : undefined
                  }
                  projectId={record.id}
                  hasEmail={!!record.email}
                  context={emailContext}
                  sendPlans={sendPlans}
                  aiEnabled={ai}
                />
              </div>
            </div>

            {/* ---- Context rail ---- */}
            <aside className="min-w-0 space-y-8">
              {ai && (
                <RailCard title="Suggested next step">
                  <p className="mb-4 text-sm text-muted">
                    An AI read on where this project stands and the best next
                    move.
                  </p>
                  <NextActionNudge projectId={record.id} />
                </RailCard>
              )}

              <div id="links">
                <RailCard title="Links & files">
                  <p className="mb-4 text-sm text-muted">
                    What you and the client share on this project. The client
                    sees every entry in their portal.
                  </p>
                  <AdminProjectLinks
                    projectId={record.id}
                    documents={record.documents ?? []}
                    announceIds={announceIds}
                  />
                </RailCard>
              </div>

              {completionUrl && (
                <RailCard title="Client completion link">
                  <p className="mb-3 text-sm text-muted">
                    Send this so the client{" "}
                    {record.serviceType
                      ? "fills the planning questionnaire"
                      : "sends an inquiry that sets the service"}.
                    It attaches to this project, so there is no duplicate.
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
              )}

              <RailCard title="Details">
                <div className="divide-y divide-border">
                  {/* Both are set by the emails sent from Compose. */}
                  <Read
                    label="Next follow-up"
                    value={
                      record.followUpAt
                        ? [formatLongDate(record.followUpAt), record.followUpNote]
                            .filter(Boolean)
                            .join(": ")
                        : undefined
                    }
                  />
                  <Read
                    label="Date held until"
                    value={formatLongDate(runningHold?.until) || undefined}
                  />
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
                            .join(", "),
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
                  {record.statusHistory && record.statusHistory.length > 0 && (
                    <div className="py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">
                        Status history
                      </div>
                      {/* Newest first — the latest move is what the rail is for. */}
                      <ul className="mt-1 space-y-1.5">
                        {[...record.statusHistory].reverse().map((he, i) => (
                          <li key={i} className="text-sm">
                            <div className="flex items-baseline justify-between gap-3">
                              <span>{statusTitle(he.status) || "Note"}</span>
                              {he.changedAt && (
                                <span className="whitespace-nowrap text-xs text-muted">
                                  {formatLongDate(he.changedAt, {
                                    timeZone: STUDIO_TIME_ZONE,
                                  })}
                                </span>
                              )}
                            </div>
                            {he.note && (
                              <div className="text-xs text-muted">
                                {he.note}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Read label="Created" value={formatStamp(record.createdAt)} />
                  <Read label="Last updated" value={formatStamp(record.updatedAt)} />
                </div>
              </RailCard>

              {siblings.length >= 2 && (
                <div>
                  <h2 className="font-serif text-xl mb-3">Bundle</h2>
                  <p className="mb-3 text-sm text-muted">
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
                <p className="mb-4 text-sm text-muted">
                  Grant a second photographer read-only portal access to this
                  project: details, dates, the timeline and shared files, and
                  the planning answers about the shoot. Never the budget, the
                  package they chose, how they&rsquo;re paying, or the proposal,
                  contract and invoices. Per project; remove anytime.
                </p>
                <AdminCollaborators
                  projectId={record.id}
                  collaborators={record.collaborators ?? []}
                />
              </RailCard>

              <RailCard title="Danger zone" tone="danger">
                <p className="mb-4 text-sm text-muted">
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
