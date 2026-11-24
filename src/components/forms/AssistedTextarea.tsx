"use client";

// A controlled <textarea> with an opt-in "Help me write this" assistant. The
// draft lands in a separate editable box and replaces the field only on "Use
// this". Shown only when AI is configured (`assist.enabled`).

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

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
  "w-full px-4 py-3 rounded border border-border bg-white focus:outline-none focus:border-foreground transition";

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
  invalid,
  errorId,
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
  // Validation hooks the caller wires to its own error state, so the field
  // announces itself as invalid and points at the message.
  invalid?: boolean;
  errorId?: string;
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
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        className={textareaClassName}
      />

      {assist.enabled && !open && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={openPanel}>
            Help me write this
          </Button>
        </div>
      )}

      {assist.enabled && open && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/[0.04] p-4 space-y-3">
          <div>
            <label
              htmlFor={`${id}-assist-notes`}
              className="block text-xs font-medium uppercase tracking-[0.15em] text-muted mb-1.5"
            >
              Your rough notes
            </label>
            <textarea
              id={`${id}-assist-notes`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A few rough notes, or even keywords. I'll shape them into a clear answer."
              className={INPUT}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={runDraft}
              loading={status === "drafting"}
              loadingLabel="Drafting…"
            >
              {status === "drafted" ? "Try again" : "Draft this"}
            </Button>
            <Button variant="text" onClick={closePanel}>
              Cancel, keep mine
            </Button>
            <FormStatus state={status} error="Couldn’t draft. Try again." />
          </div>

          {status === "drafted" && (
            <div className="space-y-2 border-t border-accent/20 pt-3">
              <label
                htmlFor={`${id}-assist-draft`}
                className="block text-xs font-medium uppercase tracking-[0.15em] text-muted"
              >
                Suggested draft: edit it, then use it
              </label>
              <textarea
                id={`${id}-assist-draft`}
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={INPUT}
              />
              {tip && (
                <p className="text-xs text-muted">
                  <span className="text-accent">Tip:</span> {tip}
                </p>
              )}
              <Button size="sm" onClick={useDraft}>
                Use this
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
