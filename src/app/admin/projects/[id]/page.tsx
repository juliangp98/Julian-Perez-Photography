import { redirect } from "next/navigation";
import { contactLine, formatEventDate, formatStamp, formatHumanDate, studioToday } from "@/lib/field-format";
import { DOCUMENT_TYPES, paymentMethodLabel, sourceLabel } from "@/lib/labels";
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
import ComposeLink from "@/components/admin/ComposeLink";
import InquiryTriage from "@/components/admin/ai/InquiryTriage";
import { aiEnabled } from "@/lib/ai/ai";
import { projectDisplayName, autoProjectName } from "@/lib/project-name";
import { buildAnswerGroups } from "@/lib/questionnaire-digest";
import { getQuestionnaire } from "@/lib/questionnaires";
import { emailTokens } from "@/lib/email/email-tokens";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";
import { heldUntil, planSendEffects, type SendEffectsPlan } from "@/lib/email/send-effects";
import { getAnyService } from "@/lib/content";
import { serviceTitle } from "@/lib/services-data";
import { projectLink, projectLinks } from "@/lib/project-links";
import { ownerNextStep, sentTemplates } from "@/lib/next-step";
import DeleteProjectButton from "@/components/admin/DeleteProjectButton";
import AdminCollaborators from "@/components/admin/AdminCollaborators";
import AdminProjectLinks from "@/components/admin/AdminProjectLinks";
import ActivityLog from "@/components/admin/ActivityLog";
import CallTab from "@/components/admin/CallTab";
import FollowUpEditor from "@/components/admin/FollowUpEditor";
import NextStepStrip from "@/components/admin/NextStepStrip";
import ProjectOverview from "@/components/admin/ProjectOverview";
import StatusControl from "@/components/admin/StatusControl";
import StageTracker from "@/components/ui/StageTracker";
import CopyField from "@/components/ui/CopyField";
import { buttonClass } from "@/components/ui/Button";
import { RailCard, Detail } from "@/components/ui/RailCard";
import Panel from "@/components/ui/Panel";
import MessageThread from "@/components/messages/MessageThread";
import { isConversation, listProjectMessages, ensureReplyToken } from "@/lib/messages";
import { triageSteer } from "@/lib/triage";
import { isCurrent } from "@/lib/ai/project-context";
import { logAddress } from "@/lib/email/inbound";

export const metadata: Metadata = {
  title: "Project · Admin",
  robots: { index: false, follow: false },
};

// The page's tabs, in order, by their ?tab= value ("" for the Overview).
const TABS = [
  { key: "", label: "Overview" },
  { key: "call", label: "Call" },
  { key: "messages", label: "Messages" },
  { key: "links", label: "Links & files" },
  { key: "details", label: "Details" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // ?tab= picks the tab (the Overview without one). ?compose=<template id>
  // opens Compose, on the Messages tab, on a template: the assessment, the
  // next step and the links hand off this way. A link's "Tell the client"
  // adds &doc=<entry id>, which only tells one hand-off from the next. No
  // client detail rides in the address: the inquiry reply is steered from the
  // saved assessment.
  searchParams: Promise<{ compose?: string; doc?: string; tab?: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");
  const { id } = await params;
  const { compose, doc, tab: tabParam } = await searchParams;
  const tab: TabKey =
    TABS.find((t) => t.key && t.key === tabParam)?.key ?? (compose ? "messages" : "");
  const record = await getClientFull(id);
  // Siblings (same person), offered as bundle-link choices.
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
  // The conversation as the board counts it: when each side last wrote, and
  // the templates that have gone out (one whose email bounced or failed
  // doesn't count).
  const conversation = messages.filter(isConversation);
  const lastInAt = conversation.filter((m) => m.direction === "in").at(-1)?.sentAt;
  const lastOutAt = conversation.filter((m) => m.direction === "out").at(-1)?.sentAt;
  // An email the client marked as spam arrived, so it counts as sent.
  const sent = sentTemplates(
    messages.map((m) => ({
      ...m,
      wentOut: isConversation(m) || (m.direction === "out" && m.status === "complained"),
    })),
    record?.statusHistory,
  );
  const hasQuestionnaire = !!record?.serviceType && !!getQuestionnaire(record.serviceType);
  const next = record
    ? ownerNextStep(
        { ...record, lastInAt, lastOutAt },
        { today, sent, questionnaire: hasQuestionnaire, turnaroundDays: service?.turnaroundDays },
      )
    : undefined;
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

  const page = record ? `/admin/projects/${record.id}` : "";
  // Each hand-off opens Compose afresh; the same address opens the same one.
  // With none ("|", NO_HANDOFF), it shows the email being written, as does a
  // hand-off to the template that email was started on (compose-draft.ts).
  const composeKey = `${compose ?? ""}|${doc ?? ""}`;
  const venue = record?.locations?.[0]?.label || record?.locations?.[0]?.address;
  const facts = record
    ? [
        service?.title ?? serviceTitle(record.serviceType),
        formatEventDate(record.eventDate),
        venue,
        record.guestCount != null
          ? `${record.guestCount} ${record.guestCount === 1 ? "guest" : "guests"}`
          : undefined,
        record.paymentMethod ? `Pays by ${paymentMethodLabel(record.paymentMethod)}` : undefined,
        contactLine(lastInAt, lastOutAt, today) ?? undefined,
      ].filter(Boolean)
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

      {!record || !next ? (
        <div className="mt-8 p-8 border border-dashed border-border rounded-lg text-muted">
          That project couldn&rsquo;t be found.
        </div>
      ) : (
        <>
          {/* ---- Header: who, the facts, where it stands, what's next ---- */}
          <div className="mt-4">
            <h1 className="font-serif text-4xl">{projectDisplayName(record)}</h1>
            {(record.clientName || record.email || record.phone) && (
              <p className="mt-1 text-sm text-muted">
                {[record.clientName, record.email, record.phone].filter(Boolean).join(" · ")}
              </p>
            )}
            {facts.length > 0 && <p className="mt-2 text-sm">{facts.join(" · ")}</p>}
          </div>

          <div className="mt-6">
            <StageTracker project={record} />
          </div>

          <div className="mt-6 grid lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
            <NextStepStrip projectId={record.id} step={next} />
            <Panel className="space-y-4">
              <StatusControl
                projectId={record.id}
                status={record.status}
                clears={!!record.followUpAt || !!record.holdUntil}
              />
              <FollowUpEditor
                projectId={record.id}
                at={record.followUpAt}
                note={record.followUpNote}
                today={today}
              />
              <ComposeLink href={`${page}?tab=messages#compose`} className={buttonClass("ghost", "sm")}>
                Write email
              </ComposeLink>
            </Panel>
          </div>

          <div className="mt-8">
            <SubNav
              label="Project"
              items={TABS.map((t) => ({ label: t.label, href: t.key ? `${page}?tab=${t.key}` : page }))}
              activeHref={tab ? `${page}?tab=${tab}` : page}
            />
          </div>

          {tab === "" && (
            <ProjectOverview
              record={record}
              ai={ai}
              sent={sent}
              questionnaire={hasQuestionnaire}
              holdUntil={runningHold?.until}
              triage={{ saved: savedTriage, current: triageCurrent }}
              brief={{ saved: savedBrief, current: briefCurrent }}
              answerGroups={answerGroups}
            />
          )}

          {tab === "call" && <CallTab record={record} messages={messages} ai={ai} />}

          {tab === "messages" && (
            <div className="mt-8 max-w-4xl space-y-12">
              <div>
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
                {/* Replying to the inquiry: what they wrote, and how it was assessed. */}
                {compose === "inquiry-reply" && record.inquiryMessage?.trim() && (
                  <Panel className="mb-6 space-y-4">
                    <h3 className="font-serif text-lg">Their inquiry</h3>
                    <p className="text-sm whitespace-pre-line leading-relaxed">{record.inquiryMessage}</p>
                    {savedTriage && (
                      <InquiryTriage
                        projectId={record.id}
                        saved={savedTriage}
                        stale={!triageCurrent}
                        canRun={false}
                        draftLink={false}
                      />
                    )}
                  </Panel>
                )}
                <ComposeEmail
                  key={composeKey}
                  handoff={composeKey}
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
          )}

          {tab === "links" && (
            <div className="mt-8 grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-10 items-start">
              <div id="links" className="min-w-0">
                <h2 className="font-serif text-2xl">Links &amp; files</h2>
                <p className="mt-2 mb-4 text-sm text-muted">
                  What you and the client share on this project. The client
                  sees every entry in their portal. Adding one emails no one.
                </p>
                <AdminProjectLinks
                  projectId={record.id}
                  documents={record.documents ?? []}
                  announceIds={announceIds}
                />
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
            </div>
          )}

          {tab === "details" && (
            <div className="mt-8 grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-10 items-start">
              <div className="min-w-0">
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
                    serviceType: record.serviceType,
                    package: record.package,
                    eventDate: record.eventDate,
                    guestCount: record.guestCount,
                    budget: record.budget,
                    planSummary: record.planSummary,
                    paymentMethod: record.paymentMethod,
                    locations: record.locations,
                  }}
                />
              </div>

              <aside className="min-w-0 space-y-8">
                <RailCard title="Activity">
                  <ActivityLog projectId={record.id} history={record.statusHistory ?? []} />
                </RailCard>

                <RailCard title="About this project">
                  <div className="divide-y divide-border">
                    <Detail label="Source" value={sourceLabel(record.source)} className="py-2" />
                    <Detail
                      label="Referral"
                      value={record.referral ? formatReferral(record.referral, undefined) : undefined}
                      className="py-2"
                    />
                    {record.secondaryDates && record.secondaryDates.length > 0 && (
                      <Detail
                        label="Other dates"
                        value={record.secondaryDates
                          .map((d) =>
                            [d.label, formatHumanDate(d.date) || d.date].filter(Boolean).join(": "),
                          )
                          .join("\n")}
                        className="py-2"
                        preLine
                      />
                    )}
                    <Detail label="Created" value={formatStamp(record.createdAt)} className="py-2" />
                    <Detail label="Last updated" value={formatStamp(record.updatedAt)} className="py-2" />
                  </div>
                </RailCard>

                {siblings.length >= 2 && (
                  <RailCard title="Bundle">
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
                  </RailCard>
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
          )}
        </>
      )}
    </section>
  );
}
