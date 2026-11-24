import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test, expect } from "@playwright/test";

// Keeps the UI kit the only source of its pieces. A file scan, no browser:
// one dropdown control, colors only from the theme tokens, and the retired
// patterns stay gone.

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
});
