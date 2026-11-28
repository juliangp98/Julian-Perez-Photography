import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test, expect } from "@playwright/test";

// Keeps the UI kit the only source of its pieces, and other things written
// once. A file scan, no browser: one dropdown control, colors only from the
// theme tokens, the retired patterns stay gone, and the site's address lives
// in one place.

const ROOT = join(__dirname, "..", "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
const files = walk(join(ROOT, "src")).map((f) => ({
  path: relative(ROOT, f),
  // Comments don't count.
  code: readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, ""),
}));

function offenders(pattern: RegExp, allowed: string[] = []) {
  return files
    .filter((f) => !allowed.includes(f.path) && pattern.test(f.code))
    .map((f) => f.path);
}

test("the site's address is written once, as SITE_URL", () => {
  // The upload allowlist names it with and without www, on purpose. Text
  // without the scheme (the footer's label, signatures, addresses) is fine.
  expect(
    offenders(/https?:\/\/(www\.)?julianperezphotography\.com/, [
      "src/lib/site-settings-data.ts",
      "src/app/api/questionnaire-upload/route.ts",
    ]),
  ).toEqual([]);
});

test("one dropdown: <select> only inside ui/fields/Select", () => {
  expect(offenders(/<select\b/, ["src/components/ui/fields/Select.tsx"])).toEqual([]);
});

test("colors come from theme tokens, not hex or rgb in components", () => {
  // Emails and PDFs render outside the site's CSS; the global error page renders
  // without the layout; the image scrim is a gradient over photos.
  const outsideTheCss = [
    "src/lib/email/email-templates.tsx",
    "src/lib/pdf/wedding-day-plan.tsx",
    "src/lib/pdf/wedding-films-plan.tsx",
    "src/app/global-error.tsx",
    "src/components/ui/ImageScrim.tsx",
  ];
  const tsx = /(?<!&)#[0-9a-fA-F]{3,8}\b|rgba?\(/; // "&#8599;" is an entity, not a color
  expect(
    files.filter((f) => f.path.endsWith(".tsx") && !outsideTheCss.includes(f.path) && tsx.test(f.code)).map((f) => f.path),
  ).toEqual([]);
});

test("theme colors are written as tokens (text-muted), not var() arbitrary values", () => {
  expect(offenders(/\b[a-z-]+-\[var\(--(muted|border|accent|foreground|background|danger)\)\]/)).toEqual([]);
});

test("retired pieces stay gone", () => {
  expect(offenders(/\bAiButton\b|\bsubmitButtonClass\b/)).toEqual([]);
  expect(offenders(/\b(text|border|bg)-red-(300|400|500|700|800)\b/, ["src/components/ui/Badge.tsx"])).toEqual([]);
  expect(offenders(/✨/)).toEqual([]);
  // The website copy drafter took over journal drafting; the meta drafter went.
  expect(offenders(/\bJournalDrafter\b|\bMetaDrafter\b|\bCopyPolisher\b|seo-pages|api\/admin\/draft-(journal|meta)\b/)).toEqual([]);
});

// A loading.tsx anywhere above a page makes router.refresh() (on Next 16.2)
// fetch the updated page after an action and, about a third of the time, never
// show it. The CHANGELOG's "Site scaffold" section has the measurements.
test("no route loading boundaries", () => {
  const boundaries = files.map((f) => f.path).filter((p) => /^src\/app\/.*loading\.tsx$/.test(p));
  expect(boundaries, "a loading.tsx breaks router.refresh() after actions").toEqual([]);
});
