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
  | "lost";

// Ordered pipeline. The index doubles as the advancement rank: `advanceStatus`
// only moves a record forward and never regresses an already-advanced status.
// The terminal off-ramp states ("archived"/"lost") sit outside this linear
// flow and are only ever set by hand in Studio.
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

export const CLIENT_STATUS_TERMINAL: ClientStatus[] = ["archived", "lost"];

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
];

// Warm, client-facing labels for the portal — never expose the internal slug.
export const CLIENT_STATUS_CLIENT_LABEL: Record<ClientStatus, string> = {
  "new-inquiry": "Inquiry received",
  responded: "In touch",
  "in-conversation": "In conversation",
  "proposal-sent": "Proposal sent",
  booked: "Booked",
  "contract-signed": "Contract signed",
  planning: "Planning your day",
  scheduled: "On the calendar",
  shot: "Captured",
  editing: "In editing",
  delivered: "Gallery delivered",
  complete: "Complete",
  archived: "Closed",
  lost: "Closed",
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
    hint: "You're booked — so excited! Next we'll start planning your day.",
  },
  {
    key: "planning",
    label: "Planning",
    hint: "We're planning the details together and will lock in your timeline before the day.",
  },
  {
    key: "shoot",
    label: "Shoot day",
    hint: "Your day is captured! Your photos head into editing next.",
  },
  {
    key: "editing",
    label: "Editing",
    hint: "Your photos are being carefully edited — your gallery is on its way.",
  },
  {
    key: "delivered",
    label: "Delivered",
    hint: "Your gallery is ready. Enjoy every moment!",
  },
];

// Maps each internal status onto a client milestone index. Terminal states
// (archived/lost) return -1 so the portal hides the timeline for them.
const STATUS_MILESTONE: Record<ClientStatus, number> = {
  "new-inquiry": 0,
  responded: 0,
  "in-conversation": 0,
  "proposal-sent": 0,
  booked: 1,
  "contract-signed": 1,
  planning: 2,
  scheduled: 2,
  shot: 3,
  editing: 4,
  delivered: 5,
  complete: 5,
  archived: -1,
  lost: -1,
};

export function clientMilestoneIndex(status: string | undefined): number {
  if (!status) return 0;
  const i = STATUS_MILESTONE[status as ClientStatus];
  return i === undefined ? 0 : i;
}
