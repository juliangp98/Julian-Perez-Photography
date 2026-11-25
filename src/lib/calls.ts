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

export const EMPTY_SUMMARY: CallSummary = {
  background: "",
  event: "",
  priorities: "",
  logistics: "",
  actions: "",
};

// The longest an answer, the free notes and a summary part may be: the boxes
// stop there, and the save route refuses anything longer.
export const CALL_ANSWER_MAX = 5000;
export const CALL_NOTES_MAX = 20000;
export const SUMMARY_PART_MAX = 4000;

export type CallNotes = {
  // Answers by key: "<section>.<question>" for the guide's questions (see
  // src/lib/discovery-guides.ts), "tailored.<id>" for the AI's.
  answers?: Record<string, string>;
  // The question each answer was typed under, by the same key, so an answer
  // still reads right after the guide changes (a new tailoring, a different
  // service).
  asked?: Record<string, string>;
  notes?: string;
  summary?: CallSummary;
  // When the call was held: set by the summary's first save, once the
  // project has moved on.
  heldAt?: string;
  // When the answers or notes were last saved, by which open copy of the Call
  // tab, and that copy's count of saves. An autosave names the save it was
  // typed against, so a copy left open elsewhere can't overwrite newer notes,
  // while a copy retrying its own save still can, and its first try landing
  // late can't.
  savedAt?: string;
  savedBy?: string;
  savedSeq?: number;
};

// What a project holds (client_records.calls), keyed by call.
export type ProjectCalls = { discovery?: CallNotes };
export type CallKind = keyof ProjectCalls;
