"use client";

// AI triage of a project's inquiry (/api/admin/triage): summary, fit, urgency
// and key details, with a link that opens the reply composer steered by them.

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
import { useAiAction } from "./useAiAction";

const FIT_TONE: Record<TriageFit, BadgeTone> = { good: "good", maybe: "warn", poor: "muted" };
const URGENCY_TONE: Record<TriageUrgency, BadgeTone> = { high: "bad", medium: "warn", low: "muted" };

export default function InquiryTriage({ projectId }: { projectId: string }) {
  const { run, status, result: triage, error } = useAiAction<Triage>(
    "/api/admin/triage",
    (json) => (json.triaged ? (json.triage as Triage) : null),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => run({ projectId })}
          loading={status === "loading"}
          loadingLabel="Reading the inquiry…"
        >
          {triage ? "Re-run triage" : "Triage this inquiry"}
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {triage && (
        <Panel className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={FIT_TONE[triage.fit]}>{TRIAGE_FIT_LABEL[triage.fit]}</Badge>
            <Badge tone={URGENCY_TONE[triage.urgency]}>{TRIAGE_URGENCY_LABEL[triage.urgency]}</Badge>
          </div>

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

          <ComposeLink
            href={draftReplyHref(triage)}
            className="inline-block text-sm underline underline-offset-4 hover:text-accent"
          >
            Draft a reply from this
          </ComposeLink>
        </Panel>
      )}
    </div>
  );
}
