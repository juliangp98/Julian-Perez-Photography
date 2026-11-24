// Checks the text visitors and clients read against src/lib/copy-rules.json:
// no banned phrase and no em dash (use a comma, a colon or a full stop; a dash
// alone at either end of a string is a placeholder and doesn't count). Runs in
// npm run lint. Comments and AI prompts are skipped; they're read by the model.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const rules = JSON.parse(readFileSync(join(ROOT, "src/lib/copy-rules.json"), "utf8"));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const banned = rules.banned.map((b) => new RegExp(b.pattern ?? escape(b.phrase), "im"));
const isAllowed = (text) => rules.allow.some((a) => text.trim().startsWith(a));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

// String literals and JSX text, without comments or prompt blocks
// (const SYSTEM_PROMPT = [ ... ].join, const prompt = [ ... ].join).
function texts(source) {
  let inPrompt = false;
  const code = source
    .split("\n")
    .map((line) => {
      if (/(system|prompt)\w*\s*=\s*\[/i.test(line)) inPrompt = true;
      const drop = inPrompt;
      if (inPrompt && /^\s*\]\.join\(/.test(line)) inPrompt = false;
      return drop ? "" : line;
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");
  return [
    ...code.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g),
    ...code.matchAll(/>([^<>{}]+)(?=[<{])/g),
  ].map((m) => (m[1] ?? m[0]).replace(/^["'`]|["'`]$/g, ""));
}

const dashes = (s) => [...s.trim()].filter((c, i, all) => c === "—" && i > 0 && i < all.length - 1).length;

const problems = [];
for (const file of walk(join(ROOT, "src")).filter((f) => !f.includes("/src/lib/ai/"))) {
  const rel = relative(ROOT, file);
  for (const text of texts(readFileSync(file, "utf8"))) {
    const t = text.trim().slice(0, 70);
    if (dashes(text)) problems.push(`${rel}: em dash in "${t}"`);
    for (const rx of banned) if (rx.test(text) && !isAllowed(text)) problems.push(`${rel}: "${t}" uses ${rx.source}`);
  }
}

if (problems.length) {
  console.error(`Copy check: ${problems.length} problem(s)\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("Copy check: clean.");
