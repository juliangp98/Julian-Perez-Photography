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
  // The agreement and retainer are out but not back yet.
  booked: "Reserving your date",
  "contract-signed": "Contract signed",
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

// Client-facing milestone view of the pipeline. The twelve internal statuses
// collapse into six milestones a couple can follow at a glance; each carries a
// warm "here's what's happening / next" hint for the portal timeline.
export const CLIENT_MILESTONES: { key: string; label: string; hint: string }[] = [
  {
    key: "inquiry",
    label: "Inquiry",
    hint: "Thanks for reaching out! I'll be in touch about next steps and a proposal.",
  },
  {
    key: "booked",
    label: "Booked",
    hint: "You're booked. Next we'll start planning your day.",
  },
  {
    key: "planning",
    label: "Planning",
    hint: "We're planning the details together and will lock in your timeline before the day.",
  },
  {
    key: "shoot",
    label: "Shoot day",
    hint: "Your day is photographed. Your photos head into editing next.",
  },
  {
    key: "editing",
    label: "Editing",
    hint: "I'm editing your photos now. Your gallery comes next.",
  },
  {
    key: "delivered",
    label: "Delivered",
    hint: "Your gallery is ready to view and download.",
  },
];

// Maps each internal status onto a client milestone index. Terminal states
// (archived/lost) return -1 so the portal hides the timeline for them.
const STATUS_MILESTONE: Record<ClientStatus, number> = {
  "new-inquiry": 0,
  responded: 0,
  "in-conversation": 0,
  "proposal-sent": 0,
  booked: 0,
  "contract-signed": 1,
  planning: 2,
  scheduled: 2,
  shot: 3,
  editing: 4,
  delivered: 5,
  complete: 5,
  archived: -1,
  lost: -1,
  declined: -1,
};

// A status whose "what's next" differs from its milestone's.
const STATUS_HINT: Partial<Record<ClientStatus, string>> = {
  booked:
    "Sign the agreement and pay the retainer, and your date is reserved. The links are in my email and on this page.",
};

// The "what's next" line for a status: its own, or its milestone's.
export function clientStatusHint(status: string | undefined): string {
  const own = STATUS_HINT[status as ClientStatus];
  if (own) return own;
  const i = clientMilestoneIndex(status);
  return i >= 0 ? CLIENT_MILESTONES[i].hint : "";
}

export function clientMilestoneIndex(status: string | undefined): number {
  if (!status) return 0;
  const i = STATUS_MILESTONE[status as ClientStatus];
  return i === undefined ? 0 : i;
}

// ── Stages ──
//
// The path every project follows, as the admin project page tracks it: each
// stage covers the statuses listed. (The client portal still shows the six
// milestones above.) The call and the proposal are passed over when a
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
};

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
  const current = Math.max(0, stageIndex(lastOpenStatus(p)));
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
