import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { SETTINGS, isSet, missingInProduction, unfinishedSetup, unsetSettings } from "../../src/lib/config";
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

test("a setting counts as set only with a value, and setup reads unfinished only in production", () => {
  expect(isSet("X", { X: "a" })).toBe(true);
  for (const value of ["", "  ", undefined]) expect(isSet("X", { X: value }), String(value)).toBe(false);
  expect(unsetSettings(["B", "A", "C"], { A: "1", C: " " })).toEqual(["B", "C"]);

  const needed = SETTINGS.filter((s) => s.neededInProd).map((s) => s.name);
  const all = Object.fromEntries(needed.map((n) => [n, "set"]));
  // A blank value is as missing as no value.
  expect(missingInProduction({ ...all, [needed[0]]: "  " }).map((s) => s.name)).toEqual([needed[0]]);
  expect(unfinishedSetup({ NODE_ENV: "development" })).toEqual([]);
  expect(unfinishedSetup({ NODE_ENV: "production" }).map((s) => s.name)).toEqual(needed);
  expect(unfinishedSetup({ NODE_ENV: "production", ...all })).toEqual([]);
});
