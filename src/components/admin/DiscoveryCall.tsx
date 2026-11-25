"use client";

// The discovery call, on the project's Call tab. Reads from the guide for the
// project's service (src/lib/discovery-guides.ts), optionally fitted to this
// client by AI (/api/admin/ai, kind "call-guide"), with an answer box under
// each question and free notes beside them. Everything typed autosaves through
// /api/admin/update about a second and a half after typing stops, and when a
// box loses focus. After the call, "Summarize the call" drafts the five-part
// summary from the notes (kind "call-summary") with suggested updates to the
// project, each applied only when accepted; "Save summary" marks the call held.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { inputClass, labelClass } from "@/components/ui/fields/Field";
import {
  answerKey,
  type DiscoveryGuide,
  type GuideSection,
} from "@/lib/discovery-guides";
import type { CallGuideTailoring, CallUpdates, SavedAiResult } from "@/lib/ai-results";
import { SUMMARY_PARTS, type CallNotes, type CallSummary } from "@/lib/calls";
import { formatHumanDate, STUDIO_TIME_ZONE } from "@/lib/field-format";
import { useAiAction } from "./ai/useAiAction";

type Place = { label?: string; address?: string; notes?: string };

const AUTOSAVE_MS = 1500;
const RETRY_MS = 5000;

// The family sections open by default; the shared framework starts folded.
const OPEN_SECTIONS = new Set(["people", "event", "priorities", "film"]);

const savedTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO_TIME_ZONE,
  });

// Saves what was typed: changed answers and the notes, batched, a moment after
// typing stops. A failed save keeps what's pending and tries again.
function useCallAutosave(projectId: string, savedAt?: string) {
  const pending = useRef<{ answers: Record<string, string>; notes?: string }>({ answers: {} });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  // The latest flush, for the timers it sets on itself (a retry, or what was
  // typed while a save was going out).
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const later = (ms: number) => {
    timer.current = setTimeout(() => void flushRef.current(), ms);
  };
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(savedAt ? "saved" : "idle");
  const [lastSaved, setLastSaved] = useState(savedAt ?? "");

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (inFlight.current || (!Object.keys(patch.answers).length && patch.notes === undefined)) return;
    pending.current = { answers: {} };
    inFlight.current = true;
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, call: patch }),
      });
      if (!res.ok) throw new Error("save failed");
      const json = await res.json();
      setLastSaved(json.savedAt ?? new Date().toISOString());
      setState("saved");
    } catch {
      // Put it back under anything typed since, and try again shortly.
      pending.current = {
        answers: { ...patch.answers, ...pending.current.answers },
        notes: pending.current.notes ?? patch.notes,
      };
      setState("error");
      later(RETRY_MS);
    } finally {
      inFlight.current = false;
    }
    // Anything typed while this save was going out.
    if (Object.keys(pending.current.answers).length || pending.current.notes !== undefined) {
      if (!timer.current) later(AUTOSAVE_MS);
    }
  }, [projectId]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queue = useCallback(
    (change: { key: string; value: string } | { notes: string }) => {
      if ("notes" in change) pending.current.notes = change.notes;
      else pending.current.answers[change.key] = change.value;
      if (timer.current) clearTimeout(timer.current);
      later(AUTOSAVE_MS);
    },
    [],
  );

  // Save what's pending before the page goes away.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current.answers).length || pending.current.notes !== undefined) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [flush]);

  return { queue, flush, state, lastSaved };
}

function Answer({
  id,
  label,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <textarea
        id={id}
        rows={value.split("\n").length > 2 ? 4 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${inputClass} mt-1.5 text-sm`}
      />
    </div>
  );
}

export default function DiscoveryCall({
  projectId,
  guide,
  tailoring,
  tailoringStale = false,
  call,
  canRun,
  locations,
}: {
  projectId: string;
  guide: DiscoveryGuide;
  tailoring?: SavedAiResult<CallGuideTailoring>;
  // The tailoring was made before the latest messages or answers.
  tailoringStale?: boolean;
  call?: CallNotes;
  // False when AI isn't set up: the guide works without the AI parts.
  canRun: boolean;
  // The project's locations: an accepted venue update renames the first.
  locations?: Place[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(call?.answers ?? {});
  const [notes, setNotes] = useState(call?.notes ?? "");
  const autosave = useCallAutosave(projectId, call?.savedAt);

  const tailor = useAiAction<SavedAiResult<CallGuideTailoring>>(
    "/api/admin/ai",
    (json) => (json.generated ? (json.saved as SavedAiResult<CallGuideTailoring>) : null),
    { initial: tailoring ?? null, keepOnEmpty: true },
  );
  const fitted = tailor.result?.result;
  const outOfDate = tailoringStale && tailor.result?.at === tailoring?.at;

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    autosave.queue({ key, value });
  };
  const answerBox = (key: string, label: string) => (
    <Answer
      key={key}
      id={`call-${key}`}
      label={label}
      value={answers[key] ?? ""}
      onChange={(v) => setAnswer(key, v)}
      onBlur={() => void autosave.flush()}
    />
  );

  const renderSection = (section: GuideSection) => (
    <details
      key={section.id}
      open={OPEN_SECTIONS.has(section.id) || undefined}
      className="group rounded-lg border border-border bg-white p-4"
    >
      <summary className="cursor-pointer list-none">
        <span className="font-serif text-lg">{section.title}</span>
        {section.minutes && <span className="ml-2 text-xs text-muted">{section.minutes}</span>}
      </summary>
      <div className="mt-3 space-y-3">
        {fitted?.openers[section.id] && (
          <p className="text-sm text-accent">{fitted.openers[section.id]}</p>
        )}
        {section.say && section.say.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {section.say.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {section.questions?.map((q) => answerBox(answerKey(section, q), q.ask))}
      </div>
    </details>
  );

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.6fr_1fr] items-start">
      <div className="min-w-0 space-y-6">
        {/* Fitted to this client by AI, when run. */}
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl">For this client</h2>
            {canRun && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => tailor.run({ projectId, kind: "call-guide" })}
                loading={tailor.status === "loading"}
                loadingLabel="Reading everything…"
              >
                {fitted ? "Tailor again" : "Tailor to this client"}
              </Button>
            )}
          </div>
          <FormStatus
            state={tailor.status === "done" ? "ok" : tailor.status}
            ok="Tailored."
            error={tailor.error}
            className="block"
          />
          {!fitted ? (
            <p className="text-sm text-muted">
              {canRun
                ? "Reads the inquiry, the messages and any questionnaire, and adds what to know going in, how to position yourself, and questions of their own."
                : "AI isn't set up, so the general guide below is the whole guide."}
            </p>
          ) : (
            <>
              {outOfDate && (
                <p className="text-sm text-danger">
                  New messages or answers have come in since this was made. Tailor it again to include them.
                </p>
              )}
              <p className="text-xs text-muted">
                Made {formatHumanDate(tailor.result!.at, { timeZone: STUDIO_TIME_ZONE, withTime: true })}
              </p>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">At a glance</div>
                <p className="mt-1 text-sm leading-relaxed">{fitted.glance}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Your angle</div>
                <p className="mt-1 text-sm leading-relaxed">{fitted.angle}</p>
              </div>
              {fitted.internal && (
                <Panel tone="danger" className="bg-background">
                  <div className="text-xs uppercase tracking-[0.18em] text-danger">
                    Internal, don&rsquo;t read aloud
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{fitted.internal}</p>
                </Panel>
              )}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Their questions</div>
                {fitted.questions.map((q, i) => answerBox(`tailored.t${i + 1}`, q))}
              </div>
            </>
          )}
        </Panel>

        {guide.sections.map(renderSection)}

        <CallSummaryPanel
          projectId={projectId}
          call={call}
          canRun={canRun}
          locations={locations}
          onSaved={() => router.refresh()}
          flush={autosave.flush}
        />
      </div>

      {/* Free notes, in reach the whole call. */}
      <div className="min-w-0 lg:sticky lg:top-24 space-y-3">
        <label htmlFor="call-notes" className={labelClass}>
          My notes
        </label>
        <textarea
          id="call-notes"
          rows={14}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            autosave.queue({ notes: e.target.value });
          }}
          onBlur={() => void autosave.flush()}
          placeholder="Anything that doesn't fit a question."
          className={`${inputClass} text-sm`}
        />
        <FormStatus
          state={autosave.state === "saved" ? "ok" : autosave.state === "error" ? "error" : "idle"}
          ok={autosave.lastSaved ? `Saved ${savedTime(autosave.lastSaved)}` : "Saved."}
          error="Not saved yet. Trying again."
          className="block"
        />
        {autosave.state === "saving" && <p className="text-sm text-muted">Saving…</p>}
      </div>
    </div>
  );
}

const UPDATE_LABEL: Record<keyof CallUpdates, string> = {
  guestCount: "Guest count",
  eventDate: "Event date",
  venue: "Venue",
  package: "Package",
};

function CallSummaryPanel({
  projectId,
  call,
  canRun,
  locations = [],
  onSaved,
  flush,
}: {
  projectId: string;
  call?: CallNotes;
  canRun: boolean;
  locations?: Place[];
  onSaved: () => void;
  flush: () => Promise<void>;
}) {
  const empty: CallSummary = { background: "", event: "", priorities: "", logistics: "", actions: "" };
  const [summary, setSummary] = useState<CallSummary>(call?.summary ?? empty);
  const [updates, setUpdates] = useState<CallUpdates>({});
  const [accepted, setAccepted] = useState<Partial<Record<keyof CallUpdates, "ok" | "error">>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const draft = useAiAction<{ summary: CallSummary; updates: CallUpdates }>(
    "/api/admin/ai",
    (json) =>
      json.generated
        ? { summary: json.summary as CallSummary, updates: (json.updates as CallUpdates) ?? {} }
        : null,
  );

  async function summarize() {
    // The notes on screen go out first, so the summary reads them.
    await flush();
    const drafted = await draft.run({ projectId, kind: "call-summary" });
    if (drafted) {
      setSummary(drafted.summary);
      setUpdates(drafted.updates);
      setAccepted({});
    }
  }

  async function accept(field: keyof CallUpdates) {
    const value = updates[field];
    // A venue renames the first location (or adds one), keeping the others.
    const fields =
      field === "venue"
        ? { locations: [{ ...locations[0], label: String(value) }, ...locations.slice(1)] }
        : { [field]: value };
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, fields }),
      });
      if (!res.ok) throw new Error();
      setAccepted((prev) => ({ ...prev, [field]: "ok" }));
    } catch {
      setAccepted((prev) => ({ ...prev, [field]: "error" }));
    }
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, callSummary: summary }),
      });
      if (!res.ok) throw new Error();
      setSaveState("ok");
      onSaved();
    } catch {
      setSaveState("error");
    }
  }

  const suggested = (Object.keys(updates) as (keyof CallUpdates)[]).filter(
    (k) => updates[k] !== undefined && updates[k] !== null,
  );

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">After the call</h2>
        {canRun && (
          <Button
            variant="secondary"
            size="sm"
            onClick={summarize}
            loading={draft.status === "loading"}
            loadingLabel="Writing it up…"
          >
            Summarize the call
          </Button>
        )}
      </div>
      <FormStatus
        state={draft.status === "done" ? "ok" : draft.status}
        ok="Drafted from your notes. Edit, then save."
        error={draft.error}
        className="block"
      />
      {call?.heldAt && (
        <p className="text-xs text-muted">
          Call held {formatHumanDate(call.heldAt, { timeZone: STUDIO_TIME_ZONE })}.
        </p>
      )}

      {SUMMARY_PARTS.map((part) => (
        <div key={part.key}>
          <label htmlFor={`summary-${part.key}`} className={labelClass}>
            {part.label}{" "}
            <span className="font-normal text-muted">
              {part.clientSafe ? "(can shape the recap email)" : "(yours only)"}
            </span>
          </label>
          <textarea
            id={`summary-${part.key}`}
            rows={3}
            value={summary[part.key]}
            onChange={(e) => setSummary((prev) => ({ ...prev, [part.key]: e.target.value }))}
            className={`${inputClass} text-sm`}
          />
        </div>
      ))}

      {suggested.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Suggested updates</div>
          <ul className="space-y-2">
            {suggested.map((field) => (
              <li key={field} className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  {UPDATE_LABEL[field]}:{" "}
                  <strong>
                    {field === "eventDate" ? formatHumanDate(String(updates[field])) : String(updates[field])}
                  </strong>
                </span>
                {accepted[field] !== "ok" && (
                  <Button variant="text" onClick={() => accept(field)}>
                    Accept
                  </Button>
                )}
                <FormStatus
                  state={accepted[field] ?? "idle"}
                  ok="Saved."
                  error="Couldn't save. Try again."
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={save}
          disabled={!Object.values(summary).some((v) => v.trim())}
          loading={saveState === "saving"}
          loadingLabel="Saving…"
        >
          Save summary
        </Button>
        <Link
          href={`/admin/projects/${projectId}?compose=discovery-recap#compose`}
          className="text-sm underline underline-offset-4 hover:text-accent"
        >
          Write the recap
        </Link>
      </div>
      <FormStatus
        state={saveState === "saving" ? "idle" : saveState}
        ok="Saved. The call is marked held, and a follow-up is set to send the recap."
        error="Couldn't save the summary. Try again."
        className="block"
      />
    </Panel>
  );
}
