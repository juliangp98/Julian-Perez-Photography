"use client";

// On-demand AI shoot-prep brief. A button calls /api/admin/prep-brief, which
// reads the project's submitted questionnaire server-side and returns a
// structured brief (headline + sections of bullets). Rendered only when AI is
// configured and the project actually has a questionnaire snapshot.

import { useState } from "react";

type Brief = {
  headline: string;
  sections: { heading: string; bullets: string[] }[];
};

type Status = "idle" | "loading" | "done" | "copied" | "error";

function briefToText(brief: Brief): string {
  const parts: string[] = [];
  if (brief.headline) parts.push(brief.headline);
  for (const s of brief.sections) {
    parts.push([s.heading, ...s.bullets.map((b) => `- ${b}`)].join("\n"));
  }
  return parts.join("\n\n");
}

export default function PrepBrief({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [brief, setBrief] = useState<Brief | null>(null);

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/prep-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.generated && data.brief) {
        setBrief(data.brief as Brief);
        setStatus("done");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  async function copy() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(briefToText(brief));
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
            ? "Reading the questionnaire…"
            : brief
              ? "✨ Re-generate brief"
              : "✨ Generate prep brief"}
        </button>
        {brief && (
          <button
            type="button"
            onClick={copy}
            className="text-xs underline underline-offset-4 hover:text-[var(--accent)]"
          >
            {status === "copied" ? "Copied ✓" : "Copy brief"}
          </button>
        )}
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t build the brief — please try again.
          </span>
        )}
      </div>

      {brief && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
          {brief.headline && (
            <p className="font-serif text-lg leading-snug">{brief.headline}</p>
          )}
          {brief.sections.map((s, i) => (
            <div key={i}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {s.heading}
              </div>
              <ul className="mt-1.5 list-disc pl-5 text-sm space-y-1">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-[var(--muted)]">
            AI-generated from the questionnaire — skim before the shoot and
            confirm anything marked to check.
          </p>
        </div>
      )}
    </div>
  );
}
