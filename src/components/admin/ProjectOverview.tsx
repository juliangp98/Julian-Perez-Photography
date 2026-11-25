// The project page's Overview tab: what matters at the stage the project is
// in. A lead shows the inquiry with its assessment, the call summary, and the
// proposal with its date hold. A booked project shows what's done toward the
// shoot, then the questionnaire with its prep brief. After the shoot, what's
// done toward delivery. What came earlier stays below, folded. Server-rendered.

import Link from "next/link";
import Panel from "@/components/ui/Panel";
import InquiryTriage from "@/components/admin/ai/InquiryTriage";
import PrepBrief from "@/components/admin/ai/PrepBrief";
import QuestionnaireCallout from "@/components/portal/QuestionnaireCallout";
import { SUMMARY_PARTS } from "@/lib/calls";
import {
  CLIENT_STATUS_TERMINAL,
  lastOpenStatus,
  statusRank,
  type ClientStatus,
} from "@/lib/client-status";
import type { ClientRecordFull } from "@/lib/clients";
import { eventDay, formatEventDate, formatHumanDate } from "@/lib/field-format";
import { invoiceState, paymentMethodLabel } from "@/lib/labels";
import { openInvoice, projectLink } from "@/lib/project-links";
import type { AnswerGroup } from "@/lib/questionnaire-digest";
import type { AiResults } from "@/lib/ai-results";

type Item = { label: string; done: boolean; detail?: string };

// What's done toward the next milestone, as a list of ticks.
function Checklist({ title, items }: { title: string; items: Item[] }) {
  return (
    <Panel>
      <h2 className="font-serif text-xl">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-baseline gap-3 text-sm">
            <span aria-hidden className={it.done ? "text-accent" : "text-muted"}>
              {it.done ? "✓" : "○"}
            </span>
            <span className={it.done ? "" : "text-muted"}>
              {it.label}
              <span className="sr-only">{it.done ? ": done" : ": not yet"}</span>
              {it.detail && <span className="text-muted">. {it.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function ProjectOverview({
  record,
  ai,
  sent,
  questionnaire,
  holdUntil,
  triage,
  brief,
  answerGroups,
}: {
  record: ClientRecordFull;
  ai: boolean;
  // The templates already sent on this project (with the day each went out).
  sent: ReadonlyMap<string, string>;
  // Whether the service has a planning questionnaire.
  questionnaire: boolean;
  // The date hold running, if any.
  holdUntil?: string;
  triage: { saved?: AiResults["triage"]; current: boolean };
  brief: { saved?: AiResults["shoot-brief"]; current: boolean };
  answerGroups: AnswerGroup[] | null;
}) {
  const page = `/admin/projects/${record.id}`;
  // A closed project shows the stage it stopped at.
  const rank = statusRank(lastOpenStatus(record));
  const closed = CLIENT_STATUS_TERMINAL.includes(record.status as ClientStatus);
  const phase = rank < statusRank("booked") ? "lead" : rank < statusRank("shot") ? "booked" : "after";

  const docs = record.documents ?? [];
  const own = (type: string) => docs.some((d) => d.type === type && d.uploadedBy !== "client");
  const invoices = docs.filter((d) => d.type === "invoice" && d.uploadedBy !== "client");
  const unpaid = invoices.filter((d) => !d.paidAt);
  const proposal = projectLink(record, "proposal");
  const summary = record.calls?.discovery?.summary;
  const hasSummary = !!summary && SUMMARY_PARTS.some((p) => summary[p.key]?.trim());

  const inquiry = record.inquiryMessage?.trim() ? (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Inquiry</h2>
      <p className="text-sm whitespace-pre-line leading-relaxed">{record.inquiryMessage}</p>
      {(ai || triage.saved) && (
        <Panel>
          <h3 className="font-serif text-lg">Assessment</h3>
          <p className="mt-1 mb-4 text-sm text-muted">
            Fit, urgency and key details from the inquiry, with a link to draft
            the reply in Compose.
          </p>
          <InquiryTriage
            projectId={record.id}
            saved={triage.saved}
            stale={!!triage.saved && !triage.current}
            canRun={ai}
          />
        </Panel>
      )}
    </section>
  ) : null;

  const call = (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">Discovery call</h2>
        <Link href={`${page}?tab=call`} className="text-sm underline underline-offset-4 hover:text-accent">
          {hasSummary ? "Open the call" : "Open the call guide"}
        </Link>
      </div>
      {hasSummary && summary ? (
        <dl className="mt-4 space-y-3">
          {SUMMARY_PARTS.filter((p) => summary[p.key]?.trim()).map((p) => (
            <div key={p.key}>
              <dt className="text-xs uppercase tracking-[0.18em] text-muted">{p.label}</dt>
              <dd className="mt-1 text-sm whitespace-pre-line">{summary[p.key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">No summary yet.</p>
      )}
    </Panel>
  );

  const questionnaireSection = record.questionnaireSnapshot ? (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Questionnaire</h2>
      <QuestionnaireCallout groups={answerGroups} rawSnapshot={record.questionnaireSnapshot} />
      {(ai || brief.saved) && record.questionnaireSnapshot.trim() && (
        <Panel>
          <h3 className="font-serif text-lg">Shoot prep brief</h3>
          <p className="mt-1 mb-4 text-sm text-muted">
            Turn this questionnaire into a skimmable prep brief: timeline, key
            people, must-have shots, logistics.
          </p>
          <PrepBrief
            projectId={record.id}
            saved={brief.saved}
            stale={!!brief.saved && !brief.current}
            canRun={ai}
          />
        </Panel>
      )}
    </section>
  ) : null;

  if (phase === "lead") {
    return (
      <div className="mt-8 grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-10 items-start">
        <div className="min-w-0 space-y-10">
          {inquiry ?? <p className="text-sm text-muted">No inquiry message on this project.</p>}
          {questionnaireSection}
        </div>
        <div className="min-w-0 space-y-6">
          {call}
          <Panel>
            <h2 className="font-serif text-xl">Proposal</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">Proposal link</dt>
                <dd className="mt-1">
                  {proposal ? (
                    <a href={proposal.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-accent">
                      {proposal.label}
                    </a>
                  ) : closed ? (
                    <span className="text-muted">None</span>
                  ) : (
                    <Link href={`${page}?tab=links`} className="underline underline-offset-4 hover:text-accent">
                      Add one in Links &amp; files
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">Date held until</dt>
                <dd className="mt-1">{holdUntil ? formatHumanDate(holdUntil) : <span className="text-muted">No hold running</span>}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    );
  }

  const earlier = (inquiry || hasSummary) && (
    <details className="group">
      <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">
        Earlier: the inquiry and the call
      </summary>
      <div className="mt-6 grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-8 items-start">
        <div className="min-w-0">{inquiry}</div>
        {hasSummary && <div className="min-w-0">{call}</div>}
      </div>
    </details>
  );

  const open = openInvoice(record);
  const paidLine = open ? invoiceState(open) : invoices.length ? "Paid" : "No invoice yet";
  const items: Item[] =
    phase === "booked"
      ? [
          { label: "Contract added", done: own("contract") },
          {
            label: "Retainer paid",
            done: invoices.some((d) => d.paidAt),
            detail: invoices.length ? undefined : "No invoice yet",
          },
          {
            label: "How they'll pay",
            done: !!record.paymentMethod,
            detail: paymentMethodLabel(record.paymentMethod) || "Not chosen yet",
          },
          ...(questionnaire ? [{ label: "Questionnaire back", done: !!record.questionnaireSnapshot?.trim() }] : []),
          {
            label: "Shoot date set",
            done: !!eventDay(record.eventDate),
            detail: formatEventDate(record.eventDate) || undefined,
          },
          { label: "Timeline details sent", done: sent.has("timeline-details") },
        ]
      : [
          { label: "Highlights added", done: own("highlights") },
          { label: "Gallery added", done: own("gallery") },
          { label: "Gallery email sent", done: sent.has("gallery-delivery") },
          { label: "Invoices paid", done: invoices.length > 0 && !unpaid.length, detail: paidLine },
          { label: "Review asked for", done: sent.has("review-request") },
        ];

  return (
    <div className="mt-8 space-y-10">
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-x-12 gap-y-10 items-start">
        <div className="min-w-0 space-y-10">
          {questionnaireSection ??
            (questionnaire && phase === "booked" ? (
              <p className="text-sm text-muted">The questionnaire hasn&rsquo;t come back yet.</p>
            ) : null)}
        </div>
        <div className="min-w-0">
          <Checklist title={phase === "booked" ? "Toward the shoot" : "Toward delivery"} items={items} />
        </div>
      </div>
      {earlier}
    </div>
  );
}
