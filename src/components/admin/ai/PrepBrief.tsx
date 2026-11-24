"use client";

// Builds a shoot-prep brief from the project's submitted questionnaire
// (/api/admin/prep-brief): a headline and sections of bullets, copyable as text.

import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import FormStatus from "@/components/ui/FormStatus";
import { useAiAction } from "./useAiAction";

type Brief = {
  headline: string;
  sections: { heading: string; bullets: string[] }[];
};

function briefToText(brief: Brief): string {
  const parts: string[] = [];
  if (brief.headline) parts.push(brief.headline);
  for (const s of brief.sections) {
    parts.push([s.heading, ...s.bullets.map((b) => `- ${b}`)].join("\n"));
  }
  return parts.join("\n\n");
}

export default function PrepBrief({ projectId }: { projectId: string }) {
  const { run, status, result: brief, error } = useAiAction<Brief>(
    "/api/admin/prep-brief",
    (json) => (json.generated ? (json.brief as Brief) : null),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => run({ projectId })}
          loading={status === "loading"}
          loadingLabel="Reading the questionnaire…"
        >
          {brief ? "Re-generate brief" : "Generate prep brief"}
        </Button>
        {brief && <CopyButton text={briefToText(brief)} label="Copy brief" />}
        <FormStatus state={status} error={error} />
      </div>

      {brief && (
        <Panel className="space-y-4">
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
            AI-generated from the questionnaire. Skim it before the shoot and
            confirm anything marked to check.
          </p>
        </Panel>
      )}
    </div>
  );
}
