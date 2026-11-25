// The discovery-call notes being typed, kept per project for as long as the
// browser tab is open, and saved through /api/admin/update a moment after
// typing stops. Kept outside the page so leaving the Call tab and coming back
// (back and forward too, which redraw the page as it was first loaded) picks
// up what was typed rather than the page's older copy, and a save still going
// out finishes after the tab is left.
//
// Each save names the save it was typed against and this copy's own id, so a
// copy left open somewhere else can't overwrite newer notes (the route refuses
// it, 409, and the panel says so), while this copy retrying a save whose reply
// was lost isn't taken for another. A failed save keeps what's pending and
// tries again; a refused one waits for the next change.

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CallNotes } from "@/lib/calls";

const AUTOSAVE_MS = 1500;
const RETRY_MS = 5000;

export type CallSaveState = "idle" | "saving" | "saved" | "error" | "rejected" | "conflict";

export type CallDraftSnapshot = {
  answers: Record<string, string>;
  // The question each answer was typed under.
  asked: Record<string, string>;
  notes: string;
  // Answers that have had text in this copy: one emptied while typing stays
  // listed, to retype into.
  listed: Record<string, true>;
  state: CallSaveState;
  // When the notes were last saved.
  lastSaved: string;
};

type Patch = { answers: Record<string, string>; asked: Record<string, string>; notes?: string };
const emptyPatch = (): Patch => ({ answers: {}, asked: {} });

class CallDraft {
  private snap: CallDraftSnapshot;
  // The save this copy builds on: "" before the first.
  base: string;
  // This copy, as the save route knows it.
  readonly writer = crypto.randomUUID();
  private pending: Patch = emptyPatch();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(
    readonly projectId: string,
    call?: CallNotes,
  ) {
    this.base = call?.savedAt ?? "";
    const answers = call?.answers ?? {};
    this.snap = {
      answers,
      asked: call?.asked ?? {},
      notes: call?.notes ?? "",
      listed: Object.fromEntries(
        Object.keys(answers)
          .filter((key) => answers[key]?.trim())
          .map((key) => [key, true as const]),
      ),
      state: call?.savedAt ? "saved" : "idle",
      lastSaved: call?.savedAt ?? "",
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.snap;

  private set(next: Partial<CallDraftSnapshot>) {
    this.snap = { ...this.snap, ...next };
    for (const listener of this.listeners) listener();
  }

  private hasPending() {
    return Object.keys(this.pending.answers).length > 0 || this.pending.notes !== undefined;
  }

  // Something typed here hasn't reached the server yet.
  busy() {
    return this.hasPending() || this.saving !== null;
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private later(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  // A change typed: shown at once, saved shortly. A copy that lost to a newer
  // save elsewhere stops saving, but keeps what's typed on screen.
  private changed() {
    if (this.snap.state !== "conflict") this.later(AUTOSAVE_MS);
  }

  // `ask` is the question on screen, when it's known.
  setAnswer(key: string, value: string, ask?: string) {
    this.pending.answers[key] = value;
    if (ask) this.pending.asked[key] = ask;
    this.set({
      answers: { ...this.snap.answers, [key]: value },
      ...(ask ? { asked: { ...this.snap.asked, [key]: ask } } : {}),
      ...(value.trim() && !this.snap.listed[key] ? { listed: { ...this.snap.listed, [key]: true } } : {}),
    });
    this.changed();
  }

  setNotes(notes: string) {
    this.pending.notes = notes;
    this.set({ notes });
    this.changed();
  }

  // Saves what's pending now, after any save already going out. True when
  // everything typed has been saved.
  async flush(): Promise<boolean> {
    this.clearTimer();
    while (this.saving) await this.saving;
    // A failed save set its own retry: this is it.
    this.clearTimer();
    if (this.hasPending() && this.snap.state !== "conflict") await this.send();
    return !this.hasPending();
  }

  private send(): Promise<void> {
    const patch = this.pending;
    this.pending = emptyPatch();
    this.set({ state: "saving" });
    const run = (async () => {
      let failed: CallSaveState;
      try {
        const res = await fetch("/api/admin/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: this.projectId,
            call: { ...patch, base: this.base, writer: this.writer },
          }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (typeof json.savedAt === "string") this.base = json.savedAt;
          this.set({ state: "saved", lastSaved: json.savedAt ?? new Date().toISOString() });
          return;
        }
        // Worth another try: the server or the network. Not: a save refused
        // as it stands, or one that lost to a newer save.
        failed =
          res.status === 409
            ? "conflict"
            : res.status >= 500 || res.status === 429
              ? "error"
              : "rejected";
      } catch {
        failed = "error";
      }
      // Put it back under anything typed since.
      this.pending = {
        answers: { ...patch.answers, ...this.pending.answers },
        asked: { ...patch.asked, ...this.pending.asked },
        notes: this.pending.notes ?? patch.notes,
      };
      this.set({ state: failed });
      if (failed === "error") this.later(RETRY_MS);
    })().finally(() => {
      this.saving = null;
    });
    this.saving = run;
    return run;
  }
}

export type { CallDraft };

const drafts = new Map<string, CallDraft>();

// Before the tab closes or reloads: send what's pending, and ask to stay while
// it goes out.
function warnOnLeave(e: BeforeUnloadEvent) {
  for (const draft of drafts.values()) {
    if (draft.busy()) {
      void draft.flush();
      e.preventDefault();
    }
  }
}

// The draft for a project: the one this tab already has, unless the page
// brought a copy saved after it and nothing typed here is waiting. On the
// server, a throwaway copy of the page's.
function callDraft(projectId: string, call?: CallNotes): CallDraft {
  if (typeof window === "undefined") return new CallDraft(projectId, call);
  const kept = drafts.get(projectId);
  if (kept && (kept.busy() || kept.base >= (call?.savedAt ?? ""))) return kept;
  if (drafts.size === 0) window.addEventListener("beforeunload", warnOnLeave);
  const fresh = new CallDraft(projectId, call);
  drafts.set(projectId, fresh);
  return fresh;
}

export function useCallDraft(projectId: string, call?: CallNotes) {
  const [draft] = useState(() => callDraft(projectId, call));
  const snap = useSyncExternalStore(draft.subscribe, draft.snapshot, draft.snapshot);
  // Leaving the tab sends what's typed now, without waiting for the timer.
  useEffect(() => () => void draft.flush(), [draft]);
  return { draft, ...snap };
}
