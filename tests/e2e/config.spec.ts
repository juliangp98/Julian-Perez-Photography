import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { SETTINGS } from "../../src/lib/config";
import { execFileSync } from "node:child_process";

// The settings list in src/lib/config.ts covers everything the code reads,
// and the generated .env.example and docs/configuration.md are current.

const ROOT = join(__dirname, "..", "..");
// Set by the platform or the build, never by the owner.
const PLATFORM = new Set(["NODE_ENV", "VERCEL_ENV", "NEXT_RUNTIME", "CI"]);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

test("every env var the code reads is in src/lib/config.ts", () => {
  const sources = [...walk(join(ROOT, "src")), join(ROOT, "next.config.ts"), join(ROOT, "sentry.shared.ts")];
  const read = new Set(
    sources.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]),
    ),
  );
  const listed = new Set(SETTINGS.map((s) => s.name));
  expect([...read].filter((n) => !PLATFORM.has(n) && !listed.has(n)).sort()).toEqual([]);
});

test(".env.example and docs/configuration.md are generated from it (npm run env:docs)", () => {
  // Throws (failing the test) with the script's message when either is stale.
  execFileSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/env-docs.mjs", "--check"],
    { cwd: ROOT, stdio: "pipe" },
  );
});
