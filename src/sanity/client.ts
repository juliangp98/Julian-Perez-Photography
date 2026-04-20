// Shared Sanity read client. Marketing pages (currently just /journal, more
// coming in round 14) fetch through this so caching + API version stay uniform.
//
// `useCdn: true` is correct for us even though we want fresh content: Next's
// `fetch` layer holds the real freshness contract via `next: { revalidate }`
// / `tags`, so the Sanity CDN is just a low-latency origin. Bypassing it only
// buys us stale-reads-under-network-hiccup without any benefit.
//
// Why the placeholder projectId: `createClient({ projectId: "" })` throws
// synchronously ("Configuration must contain `projectId`"), which breaks the
// production build on fresh clones where env isn't set yet. Passing a
// sentinel string keeps the client constructible, and every fetch path
// gates on `isSanityConfigured()` before doing anything network-bound — so
// the placeholder never leaks into an actual request. (An earlier version
// used a lazy Proxy; @sanity/image-url reads projectId/dataset in a way
// that didn't go through the Proxy, producing `cdn.sanity.io/images/undefined/undefined/...`
// URLs. Eager construction with a placeholder sidesteps that entirely.)
//
// Draft-mode / preview token is deliberately NOT wired in this round — see the
// round-13 plan at ~/.claude/plans/splendid-frolicking-journal.md ("Out of
// scope"). When preview lands we'll create a second client here that takes
// `perspective: 'previewDrafts'` + `token`.

import { createClient } from "next-sanity";

// apiVersion pinned to the date this round shipped so responses are stable
// even if Sanity evolves defaults later. Bump intentionally, not on autopilot.
const API_VERSION = "2024-05-01";

// Valid-shaped but obviously-not-real values used only when env is unset
// OR the provided env value fails Sanity's own construction-time validation.
// Never reach the wire because of the `isSanityConfigured()` gates.
const PLACEHOLDER_PROJECT_ID = "placeholder";
const PLACEHOLDER_DATASET = "production";

// Sanity validates projectId + dataset strings on `createClient()`
// construction — if either fails, it throws synchronously and the Next
// build crashes at module evaluation (every page that pulls in
// src/lib/content.ts cascades here). We sanitize + validate first so a
// misconfigured deploy env can't take the build down. Symptoms we've
// seen in the wild:
//   - trailing whitespace from copy/paste
//   - wrapping quotes (`"production"`) kept from a .env file when pasted
//     into a deploy UI that treats them as literal
//   - uppercase letters (`Production` instead of `production`)
//
// Regex mirrors Sanity's own: lowercase letters + digits + underscores
// + dashes, optional leading tilde for dataset aliases, max 64 chars.
// Project IDs don't support the tilde but otherwise share the rule set.
const DATASET_PATTERN = /^~?[a-z0-9][a-z0-9_-]{0,63}$/;
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function sanitize(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

function validate(
  value: string | undefined,
  pattern: RegExp,
  label: string,
  fallback: string,
): { value: string; ok: boolean } {
  if (value === undefined) return { value: fallback, ok: false };
  if (pattern.test(value)) return { value, ok: true };
  // eslint-disable-next-line no-console
  console.warn(
    `[sanity/client] NEXT_PUBLIC_SANITY_${label}=${JSON.stringify(value)} is not a valid Sanity ${label.toLowerCase()} (expected ${pattern.source}). Falling back to ${JSON.stringify(fallback)}; fix the env var in your deploy settings to restore Sanity-backed content.`,
  );
  return { value: fallback, ok: false };
}

const rawProjectId = sanitize(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
const rawDataset = sanitize(process.env.NEXT_PUBLIC_SANITY_DATASET);

const projectId = validate(
  rawProjectId,
  PROJECT_ID_PATTERN,
  "PROJECT_ID",
  PLACEHOLDER_PROJECT_ID,
);
const dataset = validate(
  rawDataset,
  DATASET_PATTERN,
  "DATASET",
  PLACEHOLDER_DATASET,
);

export const sanityClient = createClient({
  projectId: projectId.value,
  dataset: dataset.value,
  apiVersion: API_VERSION,
  useCdn: true,
});

// Single truth for "do we have enough env to actually call Sanity?". The
// journal pages consult this before fetching so a fresh clone without env
// — or a deploy with a malformed env value — still builds + renders a
// graceful placeholder instead of throwing. Same pattern we use for
// Resend/Twilio in src/lib/mail.ts + src/lib/sms.ts.
//
// The `ok` flags come from the validator above: a projectId of
// `PLACEHOLDER_PROJECT_ID` means either "unset" or "set-but-invalid" —
// either way we shouldn't hit the network. Dataset validity matters
// because the image URL builder reads it directly and a bad value
// produces `cdn.sanity.io/images/.../undefined/...` URLs downstream.
export function isSanityConfigured(): boolean {
  return projectId.ok && dataset.ok;
}
