// Turn a stored questionnaire snapshot (JSON keyed by field id) into a readable
// "Label: value" digest, grouped under the questionnaire's own sections so order
// and grouping carry meaning for whatever reads it next. Shared by the AI
// prep-brief and plan-summary routes. Server-safe — pulls the schema from
// `questionnaires.ts` to resolve field ids back to human labels.

import { getQuestionnaire } from "./questionnaires";

const MAX_DIGEST_CHARS = 12_000;

function formatVal(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .filter((x) => x != null && String(x).trim())
      .map((x) => String(x).trim())
      .join("; ");
  }
  if (v == null) return "";
  return String(v).trim();
}

// Returns the grouped digest, or null when the snapshot can't be parsed into a
// non-empty set of answers (so callers can no-op cleanly).
export function buildAnswerDigest(
  serviceType: string | undefined,
  snapshot: string,
): string | null {
  let answers: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    answers = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const q = serviceType ? getQuestionnaire(serviceType) : undefined;
  const used = new Set<string>();
  const lines: string[] = [];

  if (q) {
    for (const section of q.sections) {
      const sectionLines: string[] = [];
      for (const field of section.fields) {
        const val = formatVal(answers[field.id]);
        if (!val) continue;
        used.add(field.id);
        sectionLines.push(`- ${field.label}: ${val}`);
      }
      if (sectionLines.length) {
        lines.push(`## ${section.title}`, ...sectionLines, "");
      }
    }
  }

  // Answers not covered by the schema (e.g. schema drift) — keep them by key.
  const extras: string[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (used.has(key)) continue;
    const val = formatVal(raw);
    if (!val) continue;
    extras.push(`- ${key}: ${val}`);
  }
  if (extras.length) lines.push("## Other", ...extras, "");

  const digest = lines.join("\n").trim();
  if (!digest) return null;
  return digest.length > MAX_DIGEST_CHARS
    ? `${digest.slice(0, MAX_DIGEST_CHARS)}\n…(truncated)`
    : digest;
}

export type AnswerGroup = {
  section: string;
  items: { label: string; value: string }[];
};

// Same schema-resolution as `buildAnswerDigest`, but returns the answers as
// structured groups for rich UI rendering (the admin project page) instead of a
// flat string. Returns null when the snapshot has no usable answers.
export function buildAnswerGroups(
  serviceType: string | undefined,
  snapshot: string,
): AnswerGroup[] | null {
  let answers: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    answers = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const q = serviceType ? getQuestionnaire(serviceType) : undefined;
  const used = new Set<string>();
  const groups: AnswerGroup[] = [];

  if (q) {
    for (const section of q.sections) {
      const items: { label: string; value: string }[] = [];
      for (const field of section.fields) {
        const val = formatVal(answers[field.id]);
        if (!val) continue;
        used.add(field.id);
        items.push({ label: field.label, value: val });
      }
      if (items.length) groups.push({ section: section.title, items });
    }
  }

  // Answers not covered by the schema (e.g. schema drift) — keep them by key.
  const extras: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (used.has(key)) continue;
    const val = formatVal(raw);
    if (!val) continue;
    extras.push({ label: key, value: val });
  }
  if (extras.length) groups.push({ section: "Other", items: extras });

  return groups.length ? groups : null;
}
