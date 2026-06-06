"use client";

// A controlled <textarea> plus an opt-in "Help me write this" assistant. The
// label/help around it stay the caller's responsibility — this owns the field's
// value and the assist affordance, so it drops into any of the public forms.
//
// Flow: the client writes rough notes, the assistant drafts a clear first-person
// answer into a SEPARATE, editable box, and the field is only touched if they
// pick "Use this" — so it always degrades cleanly to writing by hand. They can
// refine their notes and re-draft, edit the draft directly, or cancel back to
// their own text. The button appears only when AI is configured (`assist.enabled`,
// threaded from the server, since the client can't read the API key).

import { useState } from "react";

export type AssistContext = {
  clientName?: string;
  details?: { label: string; value: string }[];
};

export type AssistConfig = {
  kind: "inquiry" | "questionnaire" | "portal-note";
  question: string;
  service?: string;
  enabled: boolean;
  // Called at draft time so the snapshot of sibling answers / project details
  // is current.
  getContext?: () => AssistContext;
};

const INPUT =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";

type Status = "idle" | "drafting" | "drafted" | "error";

export default function AssistedTextarea({
  id,
  name,
  value,
  onChange,
  rows = 4,
  required,
  placeholder,
  textareaClassName = INPUT,
  assist,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  textareaClassName?: string;
  assist: AssistConfig;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [tip, setTip] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  function openPanel() {
    setNotes(value); // seed with whatever they've already typed
    setDraft("");
    setTip(null);
    setStatus("idle");
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setStatus("idle");
  }

  async function runDraft() {
    if (status === "drafting") return;
    setStatus("drafting");
    setTip(null);
    // Snapshot + bound the context to what the endpoint accepts (≤20 rows,
    // ≤300 chars each) so a long questionnaire never trips the schema.
    const rawCtx = assist.getContext?.();
    const context = rawCtx
      ? {
          clientName: rawCtx.clientName?.slice(0, 120),
          details: (rawCtx.details ?? [])
            .filter((d) => d.value?.trim())
            .slice(0, 20)
            .map((d) => ({
              label: d.label.slice(0, 120),
              value: d.value.trim().slice(0, 300),
            })),
        }
      : undefined;
    try {
      const res = await fetch("/api/assist/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: assist.kind,
          question: assist.question,
          service: assist.service,
          notes,
          context,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.draft === "string" && data.draft.trim()) {
        setDraft(data.draft);
        setTip(
          typeof data.tip === "string" && data.tip.trim() ? data.tip : null,
        );
        setStatus("drafted");
      } else {
        // No usable draft (e.g. AI unconfigured) — surface as a soft error.
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  function useDraft() {
    onChange(draft);
    closePanel();
  }

  return (
    <div>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={textareaClassName}
      />

      {assist.enabled && !open && (
        <button
          type="button"
          onClick={openPanel}
          className="mt-2 text-xs uppercase tracking-[0.15em] text-[var(--accent)] hover:text-[var(--foreground)] transition"
        >
          ✨ Help me write this
        </button>
      )}

      {assist.enabled && open && (
        <div className="mt-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.04] p-4 space-y-3">
          <div>
            <label
              htmlFor={`${id}-assist-notes`}
              className="block text-xs font-medium uppercase tracking-[0.15em] text-[var(--muted)] mb-1.5"
            >
              Your rough notes
            </label>
            <textarea
              id={`${id}-assist-notes`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A few rough notes — even keywords. I'll shape them into a clear answer."
              className={INPUT}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runDraft}
              disabled={status === "drafting"}
              className="px-4 py-2 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
            >
              {status === "drafting"
                ? "Drafting…"
                : status === "drafted"
                  ? "↻ Try again"
                  : "✨ Draft this"}
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition"
            >
              Cancel — keep mine
            </button>
            {status === "error" && (
              <span role="alert" className="text-sm text-red-700">
                Couldn&rsquo;t draft — please try again.
              </span>
            )}
          </div>

          {status === "drafted" && (
            <div className="space-y-2 border-t border-[var(--accent)]/20 pt-3">
              <label
                htmlFor={`${id}-assist-draft`}
                className="block text-xs font-medium uppercase tracking-[0.15em] text-[var(--muted)]"
              >
                Suggested draft — edit it, then use it
              </label>
              <textarea
                id={`${id}-assist-draft`}
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={INPUT}
              />
              {tip && (
                <p className="text-xs text-[var(--muted)]">
                  <span className="text-[var(--accent)]">Tip:</span> {tip}
                </p>
              )}
              <button
                type="button"
                onClick={useDraft}
                className="px-4 py-2 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
              >
                Use this
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
