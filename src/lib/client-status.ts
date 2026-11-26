// Canonical client-pipeline statuses — the single source of truth shared by
// the server helpers in `src/lib/clients.ts` and the client portal's
// friendly-status display. Zero runtime imports so it stays a tiny, safe
// dependency anywhere it's pulled in.

export type ClientStatus =
  | "new-inquiry"
  | "responded"
  | "in-conversation"
  | "proposal-sent"
  | "booked"
  | "contract-signed"
  | "planning"
  | "scheduled"
  | "shot"
  | "editing"
  | "delivered"
  | "complete"
  | "archived"
  | "lost"
  | "declined";

// Ordered pipeline. The index doubles as the advancement rank: `advanceStatus`
// only moves a record forward and never regresses an already-advanced status.
// The terminal off-ramp states ("archived"/"lost"/"declined") sit outside this
// linear flow. They are set by hand, or by sending a pipeline email that closes
// the project (see closeProject in src/lib/clients.ts), and only ever reopened
// by hand. "lost" is a cooled lead that may re-engage; "declined" is a prospect
// who chose another photographer (closed).
export const CLIENT_STATUS_FLOW: ClientStatus[] = [
  "new-inquiry",
  "responded",
  "in-conversation",
  "proposal-sent",
  "booked",
  "contract-signed",
  "planning",
  "scheduled",
  "shot",
  "editing",
  "delivered",
  "complete",
];

export const CLIENT_STATUS_TERMINAL: ClientStatus[] = [
  "archived",
  "lost",
  "declined",
];

// Studio dropdown options + admin-facing titles.
export const CLIENT_STATUS_OPTIONS: { value: ClientStatus; title: string }[] = [
  { value: "new-inquiry", title: "New inquiry" },
  { value: "responded", title: "Responded" },
  { value: "in-conversation", title: "In conversation" },
  { value: "proposal-sent", title: "Proposal sent" },
  { value: "booked", title: "Booked" },
  { value: "contract-signed", title: "Contract signed" },
  { value: "planning", title: "Planning" },
  { value: "scheduled", title: "Scheduled" },
  { value: "shot", title: "Shot" },
  { value: "editing", title: "Editing" },
  { value: "delivered", title: "Delivered" },
  { value: "complete", title: "Complete" },
  { value: "archived", title: "Archived" },
  { value: "lost", title: "Lost" },
  { value: "declined", title: "Declined / booked elsewhere" },
];

// Warm, client-facing labels for the portal — never expose the internal slug.
export const CLIENT_STATUS_CLIENT_LABEL: Record<ClientStatus, string> = {
  "new-inquiry": "Inquiry received",
  responded: "In touch",
  "in-conversation": "In conversation",
  "proposal-sent": "Proposal sent",
  // The agreement and retainer are out but not back yet, then both are in.
  booked: "Reserving your date",
  "contract-signed": "Booked",
  planning: "Planning your day",
  scheduled: "On the calendar",
  shot: "Captured",
  editing: "In editing",
  delivered: "Gallery delivered",
  complete: "Complete",
  archived: "Closed",
  lost: "Closed",
  declined: "Closed",
};

// Advancement rank: position in the linear flow, or -1 for terminal/unknown
// states (which should never be auto-advanced past).
export function statusRank(status: string | undefined): number {
  if (!status) return -1;
  return CLIENT_STATUS_FLOW.indexOf(status as ClientStatus);
}

// ── Stages ──
//
// The path every project follows, one list for both sides (the admin project
// page and the client's portal page): each stage covers the statuses listed. The call and the proposal are passed over when a
// project moved on without them (a small session booked straight away), so a
// tracker never shows a step nobody took.
export type StageKey =
  | "inquiry"
  | "call"
  | "proposal"
  | "reserving"
  | "booked"
  | "planning"
  | "shoot"
  | "editing"
  | "delivered"
  | "complete";

export const STAGES: { key: StageKey; label: string; statuses: ClientStatus[] }[] = [
  { key: "inquiry", label: "Inquiry", statuses: ["new-inquiry", "responded"] },
  { key: "call", label: "Call", statuses: ["in-conversation"] },
  { key: "proposal", label: "Proposal", statuses: ["proposal-sent"] },
  { key: "reserving", label: "Reserving your date", statuses: ["booked"] },
  { key: "booked", label: "Booked", statuses: ["contract-signed"] },
  { key: "planning", label: "Planning", statuses: ["planning"] },
  { key: "shoot", label: "Shoot", statuses: ["scheduled"] },
  { key: "editing", label: "Editing", statuses: ["shot", "editing"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "complete", label: "Complete", statuses: ["complete"] },
];

export type StageState = "done" | "current" | "upcoming";
export type StageView = { key: StageKey; label: string; state: StageState };

// What a project's stages read from it.
export type StageProject = {
  status?: string;
  statusHistory?: { status?: string }[];
  calls?: { discovery?: { heldAt?: string } };
  documents?: { type?: string }[];
  // The client's date is still being reserved though the status moved past
  // Booked (stillReserving in src/lib/next-step.ts): their tracker and status
  // stay at Reserving your date.
  reserving?: boolean;
};

// The status a client's page shows: Booked's while the date is still being
// reserved, else the project's own.
export function shownStatus(p: StageProject): string | undefined {
  return p.reserving ? "booked" : p.status;
}

// What a second photographer's tracker reads: where the shoot stands, without
// the sales steps before the booking (a call, a proposal) or how the
// booking itself stands.
export function shootStage(p: StageProject): StageProject {
  return {
    status: p.status,
    statusHistory: (p.statusHistory ?? []).filter((h) => h.status !== "in-conversation" && h.status !== "proposal-sent"),
  };
}

// The stage a status belongs to, or -1 for a closed or unknown one.
function stageIndex(status: string | undefined): number {
  return STAGES.findIndex((s) => s.statuses.includes(status as ClientStatus));
}

// The entries in a project's activity log that moved it: a status different
// from the one before. Notes (marked, or older ones under an unchanged
// status) and the notes kept before the log aren't moves.
export function statusMoves<E extends { status?: string; kind?: string; from?: string }>(history: E[]): E[] {
  let before: string | undefined;
  const moves: E[] = [];
  for (const e of history) {
    if (e.kind === "note" || e.from) continue;
    if (e.status !== before) moves.push(e);
    before = e.status;
  }
  return moves;
}

// Where a project stands in the pipeline: its status, or for a closed one the
// last status it held before closing (undefined when it never held one).
export function lastOpenStatus(p: StageProject): string | undefined {
  if (!CLIENT_STATUS_TERMINAL.includes(p.status as ClientStatus)) return p.status;
  return [...(p.statusHistory ?? [])].reverse().find((h) => stageIndex(h.status) >= 0)?.status;
}

// A project's stages, in order, each done, current or still to come. `step`
// counts the current stage among those shown (1-based). A closed project
// shows where it stopped: the stage of the last status it held in the
// pipeline, with `closed` set.
export function stagesFor(p: StageProject): {
  stages: StageView[];
  step: number;
  closed: boolean;
} {
  const closed = CLIENT_STATUS_TERMINAL.includes(p.status as ClientStatus);
  const history = p.statusHistory ?? [];
  const current = Math.max(0, stageIndex(p.reserving ? "booked" : lastOpenStatus(p)));
  const held = (status: ClientStatus) => history.some((h) => h.status === status);
  const took: Partial<Record<StageKey, boolean>> = {
    call: held("in-conversation") || !!p.calls?.discovery?.heldAt,
    proposal: held("proposal-sent") || !!p.documents?.some((d) => d.type === "proposal"),
  };
  const stages = STAGES.flatMap((s, i): StageView[] => {
    if (i < current && took[s.key] === false) return [];
    return [{ key: s.key, label: s.label, state: i < current ? "done" : i === current ? "current" : "upcoming" }];
  });
  return { stages, step: stages.findIndex((s) => s.state === "current") + 1, closed };
}

// The tracker in a line: "Step 3 of 9: Reserving your date", or where a
// closed project stopped.
export function stageLine(p: StageProject): string {
  const { stages, step, closed } = stagesFor(p);
  const current = stages[step - 1];
  return closed ? `Closed at ${current.label}` : `Step ${step} of ${stages.length}: ${current.label}`;
}
