"use client";

// The shoot brief built from the project's submitted questionnaire: a headline
// and sections of bullets, copyable as text. Shows the one saved on the
// project, and builds it (again) through /api/admin/ai, kind "shoot-brief".

import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import FormStatus from "@/components/ui/FormStatus";
import type { SavedAiResult, ShootBrief as Brief } from "@/lib/ai-results";
import { formatHumanDate, STUDIO_TIME_ZONE } from "@/lib/field-format";
import { useAiAction } from "./useAiAction";

function briefToText(brief: Brief): string {
  const parts: string[] = [];
  if (brief.headline) parts.push(brief.headline);
  for (const s of brief.sections) {
    parts.push([s.heading, ...s.bullets.map((b) => `- ${b}`)].join("\n"));
  }
  return parts.join("\n\n");
}

export default function PrepBrief({
  projectId,
  saved,
  stale = false,
  canRun = true,
}: {
  projectId: string;
  saved?: SavedAiResult<Brief>;
  // The saved brief was made from answers the client has since changed.
  stale?: boolean;
  // False when AI isn't set up: the saved brief shows, without the button.
  canRun?: boolean;
}) {
  const { run, status, result, error } = useAiAction<SavedAiResult<Brief>>(
    "/api/admin/ai",
    (json) => (json.generated ? (json.saved as SavedAiResult<Brief>) : null),
    { initial: saved ?? null, keepOnEmpty: true },
  );
  const brief = result?.result;
  // A fresh run replaces the out-of-date one.
  const outOfDate = stale && result?.at === saved?.at;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {canRun && (
          <Button
            variant="secondary"
            onClick={() => run({ projectId, kind: "shoot-brief" })}
            loading={status === "loading"}
            loadingLabel="Reading the questionnaire…"
          >
            {brief ? "Re-generate brief" : "Generate prep brief"}
          </Button>
        )}
        {brief && <CopyButton text={briefToText(brief)} label="Copy brief" />}
        <FormStatus state={status === "done" ? "ok" : status} ok="Brief ready." error={error} />
      </div>

      {brief && (
        <Panel className="space-y-4">
          {outOfDate && (
            <p className="text-sm text-danger">
              The client has changed their answers since this brief was made.
              Re-generate it before the shoot.
            </p>
          )}
          {brief.headline && (
            <p className="font-serif text-lg leading-snug">{brief.headline}</p>
          )}
          {brief.sections.map((s, i) => (
            <div key={i}>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">
                {s.heading}
              </div>
              <ul className="mt-1.5 list-disc pl-5 text-sm space-y-1">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-muted">
            AI-generated from the questionnaire
            {result ? ` on ${formatHumanDate(result.at, { timeZone: STUDIO_TIME_ZONE })}` : ""}.
            Skim it before the shoot and confirm anything marked to check.
          </p>
        </Panel>
      )}
    </div>
  );
}
