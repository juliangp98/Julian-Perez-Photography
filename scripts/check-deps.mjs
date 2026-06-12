// Dependency + integration health check, with an optional safe-update mode.
//
//   npm run deps:check    — report only: npm freshness, security audit, and
//                           live checks of the third-party services npm can't
//                           see (Groq model availability, Sanity reachability).
//   npm run deps:update   — apply the safe layer: in-range `npm update`,
//                           same-major bumps for the exact-pinned framework
//                           packages, `npm audit fix`, and a Playwright browser
//                           install when the test runner moved. Major versions
//                           are NEVER applied automatically — they're listed
//                           for a deliberate, researched decision.
//
// After an update run, verify before relying on it:
//   npm run lint && npm run build && npx playwright test --workers=1
//
// Run via the npm scripts (they load .env.local for the integration checks);
// without env keys those checks are skipped, never failed.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const UPDATE = process.argv.includes("--update");

// Framework packages kept at exact versions in package.json (npm update skips
// exact pins, so same-major bumps are handled explicitly with --save-exact).
const EXACT_PINNED = ["next", "react", "react-dom", "eslint-config-next"];

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function shJson(cmd) {
  // npm exits non-zero when it has findings; the JSON is still on stdout.
  try {
    return JSON.parse(sh(cmd));
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        return null;
      }
    }
    return null;
  }
}
const log = (s = "") => console.log(s);
const header = (s) => log(`\n━━ ${s} ${"━".repeat(Math.max(0, 60 - s.length))}`);

// ── 1. npm package freshness ──────────────────────────────────────────────────
header("Package freshness");
const outdated = shJson("npm outdated --json --long") ?? {};
const inRange = [];   // npm update will take these
const pinnedPatch = []; // exact-pinned, latest within the same major
const majors = [];    // needs a deliberate decision

for (const [name, info] of Object.entries(outdated)) {
  const { current, wanted, latest } = info;
  if (!current || !latest) continue;
  const sameMajor = current.split(".")[0] === latest.split(".")[0];
  if (EXACT_PINNED.includes(name) && sameMajor && current !== latest) {
    pinnedPatch.push({ name, current, latest });
  } else if (wanted !== current) {
    inRange.push({ name, current, wanted });
  }
  if (!sameMajor) majors.push({ name, current, latest });
}

if (!inRange.length && !pinnedPatch.length) log("✓ everything in-range is current");
for (const p of inRange) log(`  in-range:     ${p.name}  ${p.current} → ${p.wanted}`);
for (const p of pinnedPatch) log(`  pinned patch: ${p.name}  ${p.current} → ${p.latest} (same major)`);
if (majors.length) {
  log("\n  Majors held back (decide deliberately — read migration notes, or ask for an audit):");
  for (const p of majors) log(`    ${p.name}  ${p.current} → ${p.latest}`);
}

// ── 2. security audit ─────────────────────────────────────────────────────────
header("Security audit");
const audit = shJson("npm audit --json");
const sev = audit?.metadata?.vulnerabilities ?? {};
const serious = (sev.high ?? 0) + (sev.critical ?? 0);
log(
  `  critical: ${sev.critical ?? 0}   high: ${sev.high ?? 0}   moderate: ${sev.moderate ?? 0}   low: ${sev.low ?? 0}`,
);
if (serious) log("  ⚠ run `npm audit` for details — high/critical findings should not wait");
else if (sev.moderate) log("  (moderates here have historically been transitive dev-tooling — check `npm audit` if the count grows)");

// ── 3. integration freshness (the part npm can't see) ─────────────────────────
header("Service integrations");

// Groq: the configured (or default) model slugs must still be served — Groq
// retires models, and a vanished slug silently breaks every AI feature.
const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  log("  Groq: no key in env — skipped");
} else {
  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const want = [
    process.env.AI_MODEL || "llama-3.3-70b-versatile",
    process.env.AI_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
  ];
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${groqKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const ids = ((await res.json())?.data ?? []).map((m) => m.id);
    for (const slug of want) {
      log(ids.includes(slug) ? `  ✓ AI model live: ${slug}` : `  ✗ AI MODEL GONE: ${slug} — set AI_MODEL/AI_VISION_MODEL to a current model`);
    }
  } catch (err) {
    log(`  ⚠ Groq models check failed (${err.message ?? err})`);
  }
}

// Sanity: the public dataset should answer a trivial query (content path alive).
const sanityProject = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const sanityDataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
if (!sanityProject) {
  log("  Sanity: no project id in env — skipped");
} else {
  try {
    const url = `https://${sanityProject}.api.sanity.io/v2024-05-01/data/query/${sanityDataset}?query=${encodeURIComponent('*[_id=="aboutPage"][0]._id')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.json();
    log(body?.result ? "  ✓ Sanity dataset reachable (aboutPage present)" : `  ⚠ Sanity responded but aboutPage missing (status ${res.status})`);
  } catch (err) {
    log(`  ⚠ Sanity check failed (${err.message ?? err})`);
  }
}

// Supabase: reachability only (401 without a key still proves DNS + service).
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  log("  Supabase: no URL in env — skipped");
} else {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, { signal: AbortSignal.timeout(15000) });
    log(res.status < 500 ? "  ✓ Supabase reachable" : `  ⚠ Supabase returned ${res.status}`);
  } catch (err) {
    log(`  ⚠ Supabase check failed (${err.message ?? err})`);
  }
}

// Send-capable services are reported, never pinged (a ping could cost or send).
for (const [label, envKey] of [
  ["Resend", "RESEND_API_KEY"],
  ["Twilio", "TWILIO_ACCOUNT_SID"],
  ["Google Places", "GOOGLE_PLACES_API_KEY"],
  ["Vercel Blob", "BLOB_READ_WRITE_TOKEN"],
]) {
  log(`  ${process.env[envKey] ? "✓" : "·"} ${label}: ${process.env[envKey] ? "configured" : "not configured"}`);
}

// ── 4. apply (only with --update) ─────────────────────────────────────────────
if (UPDATE) {
  header("Applying safe updates");
  const pwBefore = JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")).version;

  if (inRange.length) {
    log("  npm update (in-range)…");
    sh("npm update", { stdio: "inherit" });
  }
  for (const p of pinnedPatch) {
    log(`  ${p.name} → ${p.latest} (exact pin, same major)…`);
    sh(`npm install ${p.name}@${p.latest} --save-exact`, { stdio: "inherit" });
  }
  log("  npm audit fix (non-breaking)…");
  try {
    sh("npm audit fix", { stdio: "inherit" });
  } catch {
    /* audit fix exits non-zero when findings remain — that's fine */
  }

  const pwAfter = JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")).version;
  if (pwBefore !== pwAfter) {
    log(`  Playwright moved ${pwBefore} → ${pwAfter}: installing browsers…`);
    sh("npx playwright install chromium", { stdio: "inherit" });
  }

  header("Next step");
  log("  Verify before trusting it:");
  log("    npm run lint && npm run build && npx playwright test --workers=1");
} else if (inRange.length || pinnedPatch.length || serious) {
  header("Next step");
  log("  Apply the safe layer with:  npm run deps:update");
}
log();
