"use client";

// Compose a pipeline email on a project: pick a template, it prefills from the
// project's info (with `[brackets]` for the bits to complete), edit freely, then
// Send (branded, via /api/admin/send-email) or Copy (paste into your own mail).
// The panel says up front what sending the template does to the project (its
// status, follow-up, date hold) and confirms what moved once it has gone.

import { useEffect, useState } from "react";
import Select from "@/components/ui/fields/Select";
import { useRouter } from "next/navigation";
import {
  EMAIL_TEMPLATES,
  GROUPED_TEMPLATES,
  fillTemplate,
  type EmailTemplate,
} from "@/lib/email/email-pipeline";
import { statusTitle } from "@/lib/labels";
import { formatHumanDate } from "@/lib/field-format";
import type { SendEffectsPlan } from "@/lib/email/send-effects";
import { inputClass } from "@/components/ui/fields/Field";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import FormStatus from "@/components/ui/FormStatus";

type Status = "idle" | "drafting" | "drafted" | "sending" | "sent" | "error";

const input = `${inputClass} text-sm`;

// "a, b and c"
function listOf(parts: string[]): string {
  return parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

// What sending this template does to this project, in a line.
function effectsLine(plan?: SendEffectsPlan): string {
  if (!plan) return "";
  const parts: string[] = [];
  if (plan.closeAs) parts.push(`closes the project as ${statusTitle(plan.closeAs)}`);
  if (plan.advanceTo) parts.push(`moves the project to ${statusTitle(plan.advanceTo)}`);
  if (plan.hold) parts.push(`holds the date until ${formatHumanDate(plan.hold)}`);
  if (plan.followUp) {
    parts.push(`sets a follow-up for ${formatHumanDate(plan.followUp.at)}`);
  }
  return parts.length ? `Sending this ${listOf(parts)}.` : "";
}

// What a send meant to change but couldn't, in a line.
const NOT_MOVED: Record<string, string> = {
  status: "the status",
  hold: "the date hold",
  followUp: "the follow-up",
};
function notMovedLine(notMoved?: string[]): string {
  if (!notMoved?.length) return "";
  const what = listOf(notMoved.map((n) => NOT_MOVED[n] ?? n));
  return `The email went, but ${what} couldn't be updated.${
    notMoved.includes("status") ? " Set the status at the top of the page." : ""
  }`;
}

type Moved = {
  status?: string;
  followUpAt?: string;
  followUpNote?: string;
  holdUntil?: string;
};

// What the send changed, in a line after "Sent to the client."
function movedLine(moved?: Moved): string {
  if (!moved) return "";
  const parts: string[] = [];
  if (moved.status) parts.push(`Now ${statusTitle(moved.status)}.`);
  if (moved.holdUntil) parts.push(`Date held until ${formatHumanDate(moved.holdUntil)}.`);
  if (moved.followUpAt) {
    parts.push(`Follow-up on ${formatHumanDate(moved.followUpAt)}: ${moved.followUpNote}.`);
  }
  return parts.join(" ");
}

export default function ComposeEmail({
  projectId,
  context,
  sendPlans = {},
  hasEmail,
  aiEnabled = false,
  initialTemplateId,
  initialSteer,
}: {
  // Opens on this template (and AI steer), as linked from triage or the
  // project's next step.
  initialTemplateId?: string;
  initialSteer?: string;
  projectId: string;
  context: Record<string, string | undefined>;
  // What sending each template would do to this project, by template id.
  sendPlans?: Record<string, SendEffectsPlan>;
  hasEmail: boolean;
  // When true, an "Draft with AI" affordance is offered; otherwise the panel is
  // the static template picker. Mirrors the server's AI configuration.
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  // The tokens for one template: the project's, plus the hold this template
  // would start when none is running.
  const tokensFor = (t: EmailTemplate) => {
    const hold = sendPlans[t.id]?.hold;
    return context.holdUntil || !hold ? context : { ...context, holdUntil: formatHumanDate(hold) };
  };
  const initial = EMAIL_TEMPLATES.find((t) => t.id === initialTemplateId);
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [subject, setSubject] = useState(
    initial ? fillTemplate(initial.subject, tokensFor(initial)) : "",
  );
  const [body, setBody] = useState(initial ? fillTemplate(initial.body, tokensFor(initial)) : "");
  const [instructions, setInstructions] = useState(initial ? (initialSteer ?? "") : "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [sentNote, setSentNote] = useState("");
  const [notMovedNote, setNotMovedNote] = useState("");
  // One key per version of the message: a retry or double click of the same
  // text sends once, and any edit makes it a new message.
  const [sendKey, setSendKey] = useState(() => crypto.randomUUID());
  const newVersion = () => setSendKey(crypto.randomUUID());
  // A hand-off (#compose) can come from another tab of the page, where the
  // panel wasn't on screen to scroll to, so it brings itself into view.
  useEffect(() => {
    if (window.location.hash === "#compose") document.getElementById("compose")?.scrollIntoView();
  }, []);

  function pick(id: string) {
    setTemplateId(id);
    setStatus("idle");
    newVersion();
    const t = EMAIL_TEMPLATES.find((x) => x.id === id);
    setSubject(t ? fillTemplate(t.subject, tokensFor(t)) : "");
    setBody(t ? fillTemplate(t.body, tokensFor(t)) : "");
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
    setSentNote("");
    setNotMovedNote("");
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId: templateId || undefined,
          subject,
          body,
          idempotencyKey: sendKey,
        }),
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
      setSentNote(movedLine(json.moved));
      setNotMovedNote(notMovedLine(json.notMoved));
      setStatus("sent");
      newVersion();
      router.refresh();
    } catch {
      setMessage("Couldn't reach the site. Check your connection and try again.");
      setStatus("error");
    }
  }

  const effects = templateId ? effectsLine(sendPlans[templateId]) : "";

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
          {effects && <p className="text-xs text-muted">{effects}</p>}
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
              ok={sentNote ? `Sent to the client. ${sentNote}` : "Sent to the client."}
              error={message || "Something went wrong. Try again."}
            />
            {status === "sent" && notMovedNote && (
              <FormStatus state="error" error={notMovedNote} className="basis-full" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
