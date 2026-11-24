"use client";

// Suggests a project's next step from its pipeline state (/api/admin/next-action),
// with the email template that fits when there is one.

import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { useAiAction } from "./useAiAction";

type Action = {
  nextStep: string;
  why: string;
  urgency: "high" | "medium" | "low";
  suggestedTemplate: { id: string; name: string } | null;
};

const URGENCY: Record<Action["urgency"], [string, BadgeTone]> = {
  high: ["Soon", "bad"],
  medium: ["This week", "warn"],
  low: ["No rush", "muted"],
};

export default function NextActionNudge({ projectId }: { projectId: string }) {
  const { run, status, result: action, error } = useAiAction<Action>(
    "/api/admin/next-action",
    (json) => (json.suggested ? (json.action as Action) : null),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => run({ projectId })}
          loading={status === "loading"}
          loadingLabel="Thinking…"
        >
          {action ? "Re-check next step" : "Suggest next step"}
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {action && (
        <div className="rounded-lg border border-border bg-background p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Badge tone={URGENCY[action.urgency][1]} className="mt-0.5 shrink-0">
              {URGENCY[action.urgency][0]}
            </Badge>
            <p className="text-sm font-medium leading-relaxed">
              {action.nextStep}
            </p>
          </div>
          {action.why && (
            <p className="text-sm text-muted">{action.why}</p>
          )}
          {action.suggestedTemplate && (
            <p className="text-sm">
              Suggested email:{" "}
              <Link
                href={`?compose=${action.suggestedTemplate.id}#compose`}
                scroll={false}
                className="font-medium underline underline-offset-4 hover:text-accent"
              >
                {action.suggestedTemplate.name}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
