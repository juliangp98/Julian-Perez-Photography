"use client";

// Compose a pipeline email on a project: pick a template, it prefills from the
// project's info (with `[brackets]` for the bits to complete), edit freely, then
// Send (branded, via /api/admin/send-email) or Copy (paste into your own mail).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMAIL_TEMPLATES,
  fillTemplate,
  type EmailTemplate,
} from "@/lib/email-pipeline";

// Friendly heading per pipeline stage for the picker's option groups.
const STAGE_LABEL: Record<string, string> = {
  "new-inquiry": "New inquiry",
  responded: "Responded",
  "in-conversation": "In conversation",
  "proposal-sent": "Proposal",
  booked: "Booked",
  "contract-signed": "Contract & payment",
  planning: "Planning",
  scheduled: "Scheduled / week-of",
  shot: "After the shoot",
  editing: "Editing",
  delivered: "Delivery",
  complete: "Wrap-up",
  lost: "Re-engagement",
};

// Group consecutive same-stage templates so the picker reads as a pipeline.
const GROUPED_TEMPLATES: { stage: string; items: EmailTemplate[] }[] = (() => {
  const groups: { stage: string; items: EmailTemplate[] }[] = [];
  for (const t of EMAIL_TEMPLATES) {
    const last = groups[groups.length - 1];
    if (last && last.stage === t.stage) last.items.push(t);
    else groups.push({ stage: t.stage, items: [t] });
  }
  return groups;
})();

type Status =
  | "idle"
  | "drafting"
  | "drafted"
  | "sending"
  | "sent"
  | "copied"
  | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition";

export default function ComposeEmail({
  projectId,
  context,
  hasEmail,
  aiEnabled = false,
}: {
  projectId: string;
  context: Record<string, string | undefined>;
  hasEmail: boolean;
  // When true, an "Draft with AI" affordance is offered; otherwise the panel is
  // the static template picker. Mirrors the server's AI configuration.
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function pick(id: string) {
    setTemplateId(id);
    setStatus("idle");
    const t = EMAIL_TEMPLATES.find((x) => x.id === id);
    setSubject(t ? fillTemplate(t.subject, context) : "");
    setBody(t ? fillTemplate(t.body, context) : "");
  }

  async function draft() {
    if (!templateId || status === "drafting") return;
    setStatus("drafting");
    try {
      const res = await fetch("/api/admin/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted) {
        setSubject(data.subject);
        setBody(data.body);
        setStatus("drafted");
      } else {
        // AI not configured or no record resolved — keep the static fill.
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subject, body }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <select
        value={templateId}
        onChange={(e) => pick(e.target.value)}
        aria-label="Email template"
        className={input}
      >
        <option value="">Choose a template…</option>
        {GROUPED_TEMPLATES.map((g) => (
          <optgroup key={g.stage} label={STAGE_LABEL[g.stage] ?? g.stage}>
            {g.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {templateId && (
        <>
          {aiEnabled && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Personalize this with AI
                </p>
                <button
                  type="button"
                  onClick={draft}
                  disabled={status === "drafting"}
                  className="px-4 py-2 text-sm rounded-full border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
                >
                  {status === "drafting" ? "Drafting…" : "✨ Draft with AI"}
                </button>
              </div>
              <input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional steer — e.g. “mention the rain backup plan”, “warmer tone”"
                aria-label="Extra instructions for the AI draft"
                className={input}
              />
              <p className="text-xs text-[var(--muted)]">
                Rewrites the template from this project&rsquo;s details in your
                voice. It never sends — you always review and edit first.
              </p>
            </div>
          )}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            aria-label="Subject"
            className={input}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            aria-label="Email body"
            className={`${input} font-sans leading-relaxed`}
          />
          {status === "drafted" && (
            <p className="text-xs text-[var(--accent)]">
              AI draft — review and edit before sending.
            </p>
          )}
          <p className="text-xs text-[var(--muted)]">
            Fill in any <code>[bracketed]</code> bits before sending. Sending
            emails the client through your branded template and logs it to the
            project history.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={
                status === "sending" ||
                !hasEmail ||
                !subject.trim() ||
                !body.trim()
              }
              className="px-6 py-2.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send to client"}
            </button>
            <button
              type="button"
              onClick={copy}
              className="px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
            >
              Copy
            </button>
            {!hasEmail && (
              <span className="text-xs text-[var(--muted)]">
                No email on file for this client.
              </span>
            )}
            {status === "sent" && (
              <span className="text-sm text-[var(--muted)]">Sent ✓</span>
            )}
            {status === "copied" && (
              <span className="text-sm text-[var(--muted)]">
                Copied to clipboard ✓
              </span>
            )}
            {status === "error" && (
              <span role="alert" className="text-sm text-red-700">
                Something went wrong — please try again.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
