"use client";

// The project's inquiry assessment: summary, fit, urgency and key details, as
// saved on the project (on arrival, or the last re-run), with a button to run
// it again (/api/admin/ai, kind "triage") and a link that opens the reply
// composer steered by it.

import ComposeLink from "@/components/admin/ComposeLink";
import Panel from "@/components/ui/Panel";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import {
  TRIAGE_FIT_LABEL,
  TRIAGE_URGENCY_LABEL,
  draftReplyHref,
  type InquiryTriage as Triage,
  type TriageFit,
  type TriageUrgency,
} from "@/lib/triage";
import type { SavedAiResult } from "@/lib/ai-results";
import { formatHumanDate, STUDIO_TIME_ZONE } from "@/lib/field-format";
import { useAiAction } from "./useAiAction";

const FIT_TONE: Record<TriageFit, BadgeTone> = { good: "good", maybe: "warn", poor: "muted" };
const URGENCY_TONE: Record<TriageUrgency, BadgeTone> = { high: "bad", medium: "warn", low: "muted" };

export default function InquiryTriage({
  projectId,
  saved,
  stale = false,
  canRun = true,
  draftLink = true,
}: {
  projectId: string;
  saved?: SavedAiResult<Triage>;
  // The saved assessment was made from an earlier version of the inquiry.
  stale?: boolean;
  // False when AI isn't set up: the saved assessment shows, without the button.
  canRun?: boolean;
  // False where Compose is already open on the reply, beside it.
  draftLink?: boolean;
}) {
  const { run, status, result, error } = useAiAction<SavedAiResult<Triage>>(
    "/api/admin/ai",
    (json) => (json.generated ? (json.saved as SavedAiResult<Triage>) : null),
    { initial: saved ?? null, keepOnEmpty: true },
  );
  const triage = result?.result;
  // A fresh run replaces the out-of-date one.
  const outOfDate = stale && result?.at === saved?.at;

  return (
    <div className="space-y-4">
      {canRun && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => run({ projectId, kind: "triage" })}
            loading={status === "loading"}
            loadingLabel="Reading the inquiry…"
          >
            {triage ? "Assess again" : "Assess this inquiry"}
          </Button>
          <FormStatus state={status === "done" ? "ok" : status} ok="Assessed." error={error} />
        </div>
      )}

      {triage && result && (
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={FIT_TONE[triage.fit]}>{TRIAGE_FIT_LABEL[triage.fit]}</Badge>
            <Badge tone={URGENCY_TONE[triage.urgency]}>{TRIAGE_URGENCY_LABEL[triage.urgency]}</Badge>
            <span className="text-xs text-muted">
              Assessed {formatHumanDate(result.at, { timeZone: STUDIO_TIME_ZONE, withTime: true })}
            </span>
          </div>

          {outOfDate && (
            <p className="text-sm text-danger">
              The inquiry has changed since this assessment, so the reply
              isn&rsquo;t steered by it.
              {canRun && " Assess it again to bring it up to date."}
            </p>
          )}

          <p className="text-sm leading-relaxed">{triage.summary}</p>

          {(triage.fitReason || triage.urgencyReason) && (
            <ul className="text-sm text-muted space-y-1">
              {triage.fitReason && <li>Fit: {triage.fitReason}</li>}
              {triage.urgencyReason && <li>Timing: {triage.urgencyReason}</li>}
            </ul>
          )}

          {triage.keyDetails.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">
                Key details
              </div>
              <ul className="mt-1.5 list-disc pl-5 text-sm space-y-1">
                {triage.keyDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {draftLink && (
            <ComposeLink
              href={draftReplyHref("")}
              className="inline-block text-sm underline underline-offset-4 hover:text-accent"
            >
              Draft a reply from this
            </ComposeLink>
          )}
        </Panel>
      )}
    </div>
  );
}
