// Reading the drafter's answer: "Subject: …" then the body. A line or two of
// preamble ("Here's the email:") and markdown around the label
// ("**Subject:**") are dropped; without a subject line, the fallback subject
// and the whole text. Pure.

const SUBJECT_LINE = /^\s*[*_#]*\s*subject\s*[*_]*\s*:\s*[*_]*\s*/i;

export function parseDraft(text: string, fallbackSubject: string): { subject: string; body: string } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const at = lines.slice(0, 4).findIndex((l) => SUBJECT_LINE.test(l));
  if (at >= 0) {
    const subject = lines[at].replace(SUBJECT_LINE, "").replace(/\s*[*_]+\s*$/, "").trim();
    const body = lines.slice(at + 1).join("\n").trim();
    if (subject && body) return { subject, body };
  }
  return { subject: fallbackSubject, body: text.trim() };
}
