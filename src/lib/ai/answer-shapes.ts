// Reading a model's JSON answer leniently. A part asked for as text can come
// back as a list or as null, and an over-long part is cut to its limit rather
// than failing the whole answer. When an answer still can't be used, what was
// wrong with it is described by field name only, never its text, so it can go
// to error reporting. Pure, so the specs can check it.

import { z } from "zod";

// Optional, so a part left out reads as empty: zod 4 counts an absent key as
// missing unless its schema is marked optional, whatever it accepts.
const loose = z.union([z.string(), z.array(z.unknown()), z.null()]).optional();

// The strings in a part, trimmed, blanks dropped.
function pieces(value: string | unknown[] | null | undefined): string[] {
  if (value == null) return [];
  const all = Array.isArray(value) ? value : [value];
  return all.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}

// Prose: a list comes back joined into one paragraph.
export function proseText(max: number) {
  return loose.transform((v) => pieces(v).join(" ").slice(0, max));
}

// Lines: a string is kept as written; a list comes back as "- " lines, the way
// the prompts ask for bullet lines.
export function lineText(max: number) {
  return loose.transform((v) => {
    if (typeof v === "string") return v.trim().slice(0, max);
    return pieces(v)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
      .join("\n")
      .slice(0, max);
  });
}

// Why an answer couldn't be used: no JSON object in it (most often a reply cut
// off at its length limit), or JSON in the wrong shape, with the fields at fault.
export type AnswerProblem = { reason: "unreadable" | "shape"; fields: string[] };

export function answerProblem(json: unknown, error?: z.ZodError): AnswerProblem {
  if (json === null || typeof json !== "object") return { reason: "unreadable", fields: [] };
  const fields = [...new Set((error?.issues ?? []).map((i) => i.path.join(".") || "(answer)"))];
  return { reason: "shape", fields };
}
