// Calls with a client and what's kept from them. No server imports, so the
// admin's call panel can use the types.

// The summary written after a discovery call, in five parts. The first three
// are what the client told Julian, and may shape the recap email; the last two
// are his own and never reach a client.
export type CallSummary = {
  background: string;
  event: string;
  priorities: string;
  logistics: string;
  actions: string;
};

export const SUMMARY_PARTS: { key: keyof CallSummary; label: string; clientSafe: boolean }[] = [
  { key: "background", label: "Background", clientSafe: true },
  { key: "event", label: "Event details", clientSafe: true },
  { key: "priorities", label: "Photography priorities", clientSafe: true },
  { key: "logistics", label: "Budget and logistics", clientSafe: false },
  { key: "actions", label: "My action items", clientSafe: false },
];

export type CallNotes = {
  // Answers by "<section>.<question>" (see src/lib/discovery-guides.ts).
  answers?: Record<string, string>;
  notes?: string;
  summary?: CallSummary;
  // When the call was held: set when its summary is saved.
  heldAt?: string;
  // When anything was last saved.
  savedAt?: string;
};

// What a project holds (client_records.calls), keyed by call.
export type ProjectCalls = { discovery?: CallNotes };
export type CallKind = keyof ProjectCalls;
