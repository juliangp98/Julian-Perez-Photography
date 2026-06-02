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
