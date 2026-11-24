// Turns the owner's sent emails into style examples for the drafter: long
// enough to show his voice, short enough to fit the prompt, and stripped of
// anything that identifies another client. Pure, so it can be tested alone.

const MAX_SAMPLES = 3;
const MAX_CHARS = 900;
const MIN_CHARS = 120;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redactForStyle(text: string, names: string[] = []): string {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]");
  for (const word of names.flatMap((n) => n.split(/\s+/)).filter((w) => w.length > 1)) {
    out = out.replace(new RegExp(`\\b${escape(word)}\\b`, "gi"), "[name]");
  }
  // The greeting names the client even when the record spells it differently.
  return out.replace(/^(Hi|Hello|Hey|Dear)\s+[^,\n]+,/im, "$1 [name],").trim();
}

export function pickVoiceSamples(rows: { bodyText: string; names: string[] }[]): string[] {
  return rows
    .filter((r) => r.bodyText.trim().length >= MIN_CHARS)
    .slice(0, MAX_SAMPLES)
    .map((r) => redactForStyle(r.bodyText, r.names).slice(0, MAX_CHARS));
}

// The prompt section, or nothing when there's no history yet.
export function voiceSection(samples: string[]): string[] {
  if (!samples.length) return [];
  return [
    "",
    "Emails Julian actually sent other clients recently. Match his voice from them: word choice, sentence length, warmth, how he opens and signs off. Take nothing else from them: no names, dates, prices, facts or offers.",
    ...samples.map((s, i) => `<example ${i + 1}>\n${s}\n</example>`),
  ];
}
