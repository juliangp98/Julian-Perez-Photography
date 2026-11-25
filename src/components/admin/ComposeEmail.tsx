"use client";

// Compose a pipeline email on a project: pick a template, it prefills from the
// project's info (with `[brackets]` for the bits to complete), edit freely, then
// Send (branded, via /api/admin/send-email) or Copy (paste into your own mail).

import { useState } from "react";
import Select from "@/components/ui/fields/Select";
import { useRouter } from "next/navigation";
import {
  EMAIL_TEMPLATES,
  GROUPED_TEMPLATES,
  fillTemplate,
} from "@/lib/email/email-pipeline";
import { statusTitle } from "@/lib/labels";
import { inputClass } from "@/components/ui/fields/Field";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import FormStatus from "@/components/ui/FormStatus";

type Status = "idle" | "drafting" | "drafted" | "sending" | "sent" | "error";

const input = `${inputClass} text-sm`;

export default function ComposeEmail({
  projectId,
  context,
  hasEmail,
  aiEnabled = false,
  initialTemplateId,
  initialSteer,
}: {
  // Opens on this template (and AI steer), as linked from triage or the
  // suggested next step.
  initialTemplateId?: string;
  initialSteer?: string;
  projectId: string;
  context: Record<string, string | undefined>;
  hasEmail: boolean;
  // When true, an "Draft with AI" affordance is offered; otherwise the panel is
  // the static template picker. Mirrors the server's AI configuration.
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const initial = EMAIL_TEMPLATES.find((t) => t.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [subject, setSubject] = useState(initial ? fillTemplate(initial.subject, context) : "");
  const [body, setBody] = useState(initial ? fillTemplate(initial.body, context) : "");
  const [instructions, setInstructions] = useState(initial ? (initialSteer ?? "") : "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // One key per version of the message: a retry or double click of the same
  // text sends once, and any edit makes it a new message.
  const [sendKey, setSendKey] = useState(() => crypto.randomUUID());
  const newVersion = () => setSendKey(crypto.randomUUID());

  function pick(id: string) {
    setTemplateId(id);
    setStatus("idle");
    newVersion();
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
        newVersion();
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
    if (!subject.trim() || !body.trim() || status === "sending") return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subject, body, idempotencyKey: sendKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error || "Couldn't send. Try again.");
        setStatus("error");
        return;
      }
      if (!json.sent) {
        setMessage(json.note || "Not sent.");
        setStatus("error");
        return;
      }
      setStatus("sent");
      newVersion();
      router.refresh();
    } catch {
      setMessage("Couldn't reach the site. Check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <Select
        value={templateId}
        onChange={(e) => pick(e.target.value)}
        aria-label="Email template"
        className="text-sm"
      >
        <option value="">Choose a template…</option>
        {GROUPED_TEMPLATES.map((g) => (
          <optgroup key={g.stage} label={statusTitle(g.stage)}>
            {g.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      {templateId && (
        <>
          {aiEnabled && (
            <div className="rounded-lg border border-border bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Personalize this with AI
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={draft}
                  loading={status === "drafting"}
                  loadingLabel="Drafting…"
                >
                  Draft with AI
                </Button>
              </div>
              <input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional steer, e.g. “mention the rain backup plan”, “warmer tone”"
                aria-label="Extra instructions for the AI draft"
                className={input}
              />
              <p className="text-xs text-muted">
                Rewrites the template from this project&rsquo;s details in your
                voice. It never sends. You always review and edit first.
              </p>
            </div>
          )}
          <input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              newVersion();
            }}
            placeholder="Subject"
            aria-label="Subject"
            className={input}
          />
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              newVersion();
            }}
            rows={14}
            aria-label="Email body"
            className={`${input} font-sans leading-relaxed`}
          />
          {status === "drafted" && (
            <p className="text-xs text-accent">
              AI draft. Review and edit before sending.
            </p>
          )}
          <p className="text-xs text-muted">
            Fill in any <code>[bracketed]</code> bits before sending. It goes
            to the client in your branded layout, you get a copy, and it joins
            the thread above.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={send}
              disabled={!hasEmail || !subject.trim() || !body.trim()}
              loading={status === "sending"}
              loadingLabel="Sending…"
            >
              Send to client
            </Button>
            <CopyButton text={`Subject: ${subject}\n\n${body}`} />
            {!hasEmail && (
              <span className="text-xs text-muted">
                No email on file for this client.
              </span>
            )}
            <FormStatus
              state={status === "sent" ? "ok" : status}
              ok="Sent to the client."
              error={message || "Something went wrong. Try again."}
            />
          </div>
        </>
      )}
    </div>
  );
}
