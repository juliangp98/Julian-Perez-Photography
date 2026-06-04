"use client";

// On-demand AI triage of a project's inquiry. A button calls /api/admin/triage,
// which reads the inquiry server-side and returns an assessment (summary, fit,
// urgency, key details, a suggested reply). Rendered only when AI is configured
// and the project actually has an inquiry message.

import { useState } from "react";

type Triage = {
  summary: string;
  fit: "good" | "maybe" | "poor";
  fitReason: string;
  urgency: "high" | "medium" | "low";
  urgencyReason: string;
  keyDetails: string[];
  suggestedReply: string;
};

type Status = "idle" | "loading" | "done" | "copied" | "error";

const FIT: Record<Triage["fit"], { label: string; cls: string }> = {
  good: { label: "Good fit", cls: "bg-green-50 text-green-800 border-green-200" },
  maybe: {
    label: "Possible fit",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  poor: {
    label: "Likely not a fit",
    cls: "bg-stone-100 text-stone-600 border-stone-300",
  },
};

const URGENCY: Record<Triage["urgency"], { label: string; cls: string }> = {
  high: { label: "High urgency", cls: "bg-red-50 text-red-700 border-red-200" },
  medium: {
    label: "Medium urgency",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  low: { label: "Low urgency", cls: "bg-stone-100 text-stone-600 border-stone-300" },
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

export default function InquiryTriage({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [triage, setTriage] = useState<Triage | null>(null);

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.triaged && data.triage) {
        setTriage(data.triage as Triage);
        setStatus("done");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  async function copyReply() {
    if (!triage?.suggestedReply) return;
    try {
      await navigator.clipboard.writeText(triage.suggestedReply);
      setStatus("copied");
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
            ? "Reading the inquiry…"
            : triage
              ? "✨ Re-run triage"
              : "✨ Triage this inquiry"}
        </button>
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t triage — please try again.
          </span>
        )}
      </div>

      {triage && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge label={FIT[triage.fit].label} cls={FIT[triage.fit].cls} />
            <Badge
              label={URGENCY[triage.urgency].label}
              cls={URGENCY[triage.urgency].cls}
            />
          </div>

          <p className="text-sm leading-relaxed">{triage.summary}</p>

          {(triage.fitReason || triage.urgencyReason) && (
            <ul className="text-sm text-[var(--muted)] space-y-1">
              {triage.fitReason && <li>Fit: {triage.fitReason}</li>}
              {triage.urgencyReason && <li>Timing: {triage.urgencyReason}</li>}
            </ul>
          )}

          {triage.keyDetails.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Key details
              </div>
              <ul className="mt-1.5 list-disc pl-5 text-sm space-y-1">
                {triage.keyDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {triage.suggestedReply && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Suggested reply
                </div>
                <button
                  type="button"
                  onClick={copyReply}
                  className="text-xs underline underline-offset-4 hover:text-[var(--accent)]"
                >
                  {status === "copied" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-line rounded border border-[var(--border)] bg-white p-3 text-sm leading-relaxed">
                {triage.suggestedReply}
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                A starting point — refine and send it from the Compose panel
                below. Always review before sending.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
