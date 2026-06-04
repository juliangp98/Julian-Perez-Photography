"use client";

// On-demand AI "what's the next step?" for a project. A button calls
// /api/admin/next-action, which reasons over the project's pipeline state
// server-side and returns the recommended next move (and, when relevant, which
// email template fits). Rendered only when AI is configured.

import { useState } from "react";

type Action = {
  nextStep: string;
  why: string;
  urgency: "high" | "medium" | "low";
  suggestedTemplate: { id: string; name: string } | null;
};

type Status = "idle" | "loading" | "done" | "error";

const URGENCY: Record<Action["urgency"], { label: string; cls: string }> = {
  high: { label: "Soon", cls: "bg-red-50 text-red-700 border-red-200" },
  medium: {
    label: "This week",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  low: { label: "No rush", cls: "bg-stone-100 text-stone-600 border-stone-300" },
};

export default function NextActionNudge({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [action, setAction] = useState<Action | null>(null);

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/next-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.suggested && data.action) {
        setAction(data.action as Action);
        setStatus("done");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={status === "loading"}
          className="px-4 py-2 text-sm rounded-full border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
        >
          {status === "loading"
            ? "Thinking…"
            : action
              ? "✨ Re-check next step"
              : "✨ Suggest next step"}
        </button>
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t suggest a step — please try again.
          </span>
        )}
      </div>

      {action && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 shrink-0 inline-block rounded-full border px-3 py-1 text-xs font-medium ${URGENCY[action.urgency].cls}`}
            >
              {URGENCY[action.urgency].label}
            </span>
            <p className="text-sm font-medium leading-relaxed">
              {action.nextStep}
            </p>
          </div>
          {action.why && (
            <p className="text-sm text-[var(--muted)]">{action.why}</p>
          )}
          {action.suggestedTemplate && (
            <p className="text-sm">
              Suggested email:{" "}
              <span className="font-medium">
                {action.suggestedTemplate.name}
              </span>{" "}
              <span className="text-[var(--muted)]">
                — pick it in the Compose panel below.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
