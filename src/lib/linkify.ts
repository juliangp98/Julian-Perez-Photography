// Web addresses in plain text, split out so a view or an email can make them
// links. http(s) only; punctuation that ends the sentence, and a closing
// bracket the address didn't open, stay outside the link. Pure.

export type LinkPart = { text: string; href?: string };

const URL = /https?:\/\/[^\s<>"]+/g;
const TRAILING = /[.,;:!?'"]+$/;

// "(see https://x.com/a)." → the address without ")" or "."
function trimEnd(url: string): string {
  let out = url.replace(TRAILING, "");
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(TRAILING, "");
  }
  return out;
}

export function linkParts(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL)) {
    const start = match.index ?? 0;
    const href = trimEnd(match[0]);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: href, href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Text with every web address that isn't one of `allowed` replaced by
// "[link]", so a drafted email carries only addresses it was given, and an
// invented one is left for Julian to fill in (Compose won't send brackets).
export function neutraliseLinks(text: string, allowed: Iterable<string>): string {
  const keep = new Set(allowed);
  return linkParts(text)
    .map((p) => (p.href && !keep.has(p.href) ? "[link]" : p.text))
    .join("");
}
