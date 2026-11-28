"use client";

// The discovery call, on the project's Call tab. Reads from the guide for the
// project's service (src/lib/discovery-guides.ts), optionally fitted to this
// client by AI (/api/admin/ai, kind "call-guide"), with an answer box under
// each question and free notes beside them. Everything typed autosaves (see
// call-draft.ts) about a second and a half after typing stops, and when a box
// loses focus; answers the guide on screen no longer asks (an earlier
// tailoring, the guide for another service) stay listed. After the call,
// "Summarize the call" drafts the five-part summary from the notes (kind
// "call-summary") with suggested updates to the project, each applied only
// when accepted; "Save summary" marks the call held.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { inputClass, labelClass } from "@/components/ui/fields/Field";
import {
  answerKey,
  guideQuestions,
  tailoredKey,
  type DiscoveryGuide,
  type GuideSection,
} from "@/lib/discovery-guides";
import type { CallGuideTailoring, CallUpdates, SavedAiResult } from "@/lib/ai-results";
import {
  CALL_ANSWER_MAX,
  CALL_NOTES_MAX,
  EMPTY_SUMMARY,
  SUMMARY_PART_MAX,
  SUMMARY_PARTS,
  SUMMARY_USE_NOTE,
  type CallNotes,
  type CallSummary,
} from "@/lib/calls";
import { formatHumanDate, STUDIO_TIME_ZONE } from "@/lib/field-format";
import { useAiAction } from "./ai/useAiAction";
import { composeDraft } from "@/components/admin/compose-draft";
import { useCallDraft, type CallSaveState } from "./call-draft";
import GuideSectionFold from "./GuideSectionFold";

type Place = { label?: string; address?: string; notes?: string };

const SAVE_ERRORS: Partial<Record<CallSaveState, string>> = {
  error: "Not saved yet. Trying again.",
  rejected: "Couldn't save the last change. Typing again retries it.",
  conflict:
    "These notes were saved in another window since this page opened, so this copy has stopped saving. Copy anything new, then reload.",
};

const savedTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO_TIME_ZONE,
  });

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
        maxLength={CALL_ANSWER_MAX}
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
  // The project's locations, for an accepted venue update.
  locations?: Place[];
}) {
  const router = useRouter();
  const { draft, answers, asked, notes, listed, state, lastSaved } = useCallDraft(projectId, call);

  const tailor = useAiAction<SavedAiResult<CallGuideTailoring>>(
    "/api/admin/ai",
    (json) => (json.generated ? (json.saved as SavedAiResult<CallGuideTailoring>) : null),
    { initial: tailoring ?? null, keepOnEmpty: true },
  );
  const fitted = tailor.result?.result;
  // One box per question, even if a tailoring repeats one.
  const fittedQuestions = [...new Map((fitted?.questions ?? []).map((q) => [tailoredKey(q), q])).entries()];
  const outOfDate = tailoringStale && tailor.result?.at === tailoring?.at;

  // Saved with the question on screen, so the answer reads right later.
  const answerBox = (key: string, label: string, ask: string | undefined = label) => (
    <Answer
      key={key}
      id={`call-${key}`}
      label={label}
      value={answers[key] ?? ""}
      onChange={(v) => draft.setAnswer(key, v, ask)}
      onBlur={() => void draft.flush()}
    />
  );

  // Answers to questions no longer on screen, so nothing typed is hidden. One
  // emptied here stays listed until the page is next opened.
  const shown = new Set([...guideQuestions(guide).map((q) => q.key), ...fittedQuestions.map(([key]) => key)]);
  const earlier = Object.keys(answers).filter((key) => !shown.has(key) && (answers[key]?.trim() || listed[key]));

  const renderSection = (section: GuideSection) => (
    <GuideSectionFold key={section.id} section={section} lead={fitted?.openers[section.id]}>
      {section.questions?.map((q) => answerBox(answerKey(section, q), q.ask))}
    </GuideSectionFold>
  );

  const saveStatus =
    state === "idle" ? null : (
      <>
        <FormStatus
          state={state === "saved" ? "ok" : SAVE_ERRORS[state] ? "error" : "idle"}
          ok={lastSaved ? `Saved ${savedTime(lastSaved)}` : "Saved."}
          error={SAVE_ERRORS[state]}
          className="block"
        />
        {state === "saving" && <p className="text-sm text-muted">Saving…</p>}
      </>
    );

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.6fr_1fr] items-start">
      {/* Below lg the notes sit at the bottom: the save status stays in view
          the whole way down, the notes included. */}
      {saveStatus && (
        <div className="col-span-full sticky top-16 z-30 bg-background py-2 lg:hidden">{saveStatus}</div>
      )}
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
                <Panel tone="danger" surface="background">
                  <div className="text-xs uppercase tracking-[0.18em] text-danger">
                    Internal, don&rsquo;t read aloud
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{fitted.internal}</p>
                </Panel>
              )}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Their questions</div>
                {fittedQuestions.map(([key, q]) => answerBox(key, q))}
              </div>
            </>
          )}
        </Panel>

        {guide.sections.map(renderSection)}

        {earlier.length > 0 && (
          <details open className="rounded-lg border border-border bg-white p-4">
            <summary className="cursor-pointer">
              <span className="font-serif text-lg">Answered under another guide</span>
            </summary>
            <p className="mt-2 text-sm text-muted">
              From an earlier tailoring, or the guide for another service. They&rsquo;re kept, and the
              summary reads them.
            </p>
            <div className="mt-3 space-y-3">
              {earlier.map((key) => answerBox(key, asked[key] ?? "An earlier question", asked[key]))}
            </div>
          </details>
        )}

        <CallSummaryPanel
          projectId={projectId}
          call={call}
          canRun={canRun}
          locations={locations}
          onSaved={() => router.refresh()}
          flush={() => draft.flush()}
          saveState={state}
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
          maxLength={CALL_NOTES_MAX}
          value={notes}
          onChange={(e) => draft.setNotes(e.target.value)}
          onBlur={() => void draft.flush()}
          placeholder="Anything that doesn't fit a question."
          className={`${inputClass} text-sm`}
        />
        {saveStatus && <div className="hidden lg:block">{saveStatus}</div>}
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
  saveState: notesState,
}: {
  projectId: string;
  call?: CallNotes;
  canRun: boolean;
  locations?: Place[];
  onSaved: () => void;
  // Saves the notes typed so far; false when they couldn't be saved.
  flush: () => Promise<boolean>;
  // How the notes' autosave stands, for why they couldn't be read.
  saveState: CallSaveState;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<CallSummary>(call?.summary ?? EMPTY_SUMMARY);
  // The summary as last saved, to tell when the one on screen has changed.
  const [savedSummary, setSavedSummary] = useState<CallSummary>(call?.summary ?? EMPTY_SUMMARY);
  const [updates, setUpdates] = useState<CallUpdates>({});
  const [accepted, setAccepted] = useState<Partial<Record<keyof CallUpdates, "ok" | "error">>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  // What the save did: marked the call held, and set the recap follow-up.
  const [saved, setSaved] = useState({ held: false, followUp: false });
  // Why Summarize didn't draft: the notes hadn't saved, or there was nothing.
  const [summarizeNote, setSummarizeNote] = useState<"" | "unsaved" | "empty">("");
  const draft = useAiAction<{ summary: CallSummary; updates: CallUpdates }>(
    "/api/admin/ai",
    (json) =>
      json.generated
        ? { summary: json.summary as CallSummary, updates: (json.updates as CallUpdates) ?? {} }
        : null,
  );

  const hasText = Object.values(summary).some((v) => v.trim());
  const dirty = SUMMARY_PARTS.some((p) => summary[p.key] !== savedSummary[p.key]);
  const venueNow = locations[0]?.label || locations[0]?.address;

  async function summarize() {
    setSummarizeNote("");
    // The notes on screen are saved first, so the summary reads them.
    if (!(await flush())) {
      setSummarizeNote("unsaved");
      return;
    }
    const drafted = await draft.run({ projectId, kind: "call-summary" });
    if (drafted) {
      setSummary(drafted.summary);
      setUpdates(drafted.updates);
      setAccepted({});
    } else {
      setSummarizeNote("empty");
    }
  }

  async function accept(field: keyof CallUpdates) {
    const value = updates[field];
    // A venue names the first location when it has only an address; any other
    // venue goes first as a new place, keeping the old one below it to edit.
    const first = locations[0];
    const fields =
      field === "venue"
        ? {
            locations:
              first && !first.label?.trim()
                ? [{ ...first, label: String(value) }, ...locations.slice(1)]
                : [{ label: String(value) }, ...locations],
          }
        : { [field]: value };
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, fields }),
      });
      if (!res.ok) throw new Error();
      // A recap left unsent was written from the old details.
      composeDraft.dropTemplate(projectId, "discovery-recap");
      setAccepted((prev) => ({ ...prev, [field]: "ok" }));
    } catch {
      setAccepted((prev) => ({ ...prev, [field]: "error" }));
    }
  }

  async function save(): Promise<boolean> {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, callSummary: summary }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json().catch(() => ({}));
      // A recap left unsent was written from the old summary.
      composeDraft.dropTemplate(projectId, "discovery-recap");
      setSavedSummary(summary);
      setSaved({ held: !!json.held, followUp: !!json.followUp });
      setSaveState("ok");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }

  // The recap draft reads the saved summary: an edited one is saved first, and
  // the page refreshed, so Back finds the saved summary rather than the copy
  // the browser kept from before.
  async function writeRecap() {
    if (dirty && hasText) {
      if (!(await save())) return;
      onSaved();
    }
    router.push(`/admin/projects/${projectId}?compose=discovery-recap#compose`);
  }

  const unsaved =
    notesState === "conflict"
      ? "These notes stopped saving because they changed in another window, so the summary can't read them. Copy anything new, then reload."
      : notesState === "rejected"
        ? "Your latest change couldn't save, so the summary can't read it. Edit it and try again."
        : "Your latest notes haven't saved, so the summary can't read them yet. Try again in a moment.";

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
      {/* This click's outcome first: a skipped run leaves the last one's status. */}
      <FormStatus
        state={summarizeNote || draft.status === "error" ? "error" : draft.status === "done" ? "ok" : "idle"}
        ok="Drafted from your notes. Edit, then save."
        error={
          summarizeNote === "unsaved"
            ? unsaved
            : draft.status === "error"
              ? draft.error
              : summarizeNote === "empty"
                ? "Nothing to summarize yet. Add answers or notes first."
                : draft.error
        }
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
              {SUMMARY_USE_NOTE[part.use]}
            </span>
          </label>
          <textarea
            id={`summary-${part.key}`}
            rows={3}
            maxLength={SUMMARY_PART_MAX}
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
                  {field === "venue" && venueNow && accepted.venue !== "ok" && (
                    <span className="text-muted"> (now {venueNow})</span>
                  )}
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
          onClick={async () => {
            if (await save()) onSaved();
          }}
          disabled={!hasText}
          loading={saveState === "saving"}
          loadingLabel="Saving…"
        >
          Save summary
        </Button>
        <Button variant="text" onClick={writeRecap} disabled={saveState === "saving"}>
          Write the recap
        </Button>
      </div>
      <FormStatus
        state={saveState === "saving" ? "idle" : saveState}
        ok={
          saved.held
            ? saved.followUp
              ? "Saved. The call is marked held, and a follow-up is set to send the recap."
              : "Saved. The call is marked held."
            : "Saved."
        }
        error="Couldn't save the summary. Try again."
        className="block"
      />
    </Panel>
  );
}
