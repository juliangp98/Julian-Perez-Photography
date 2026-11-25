// Which models the AI features use, chosen from the provider's live catalogue
// instead of hard-coded names. Groq retires hosted models every few months,
// sometimes a whole family at once, so:
//
// - refreshModels() lists the catalogue (free, no tokens), keeps chat models
//   with enough context, ranks them by family, and test-calls a model before
//   adopting it. The primary and the fallback come from different families, so
//   one retirement wave can't take out both. The vision model is chosen the
//   same way, probed with a tiny image.
// - Env pins (AI_MODEL, AI_FALLBACK_MODEL, AI_VISION_MODEL) win while the
//   provider still serves them and they answer.
// - The choice is stored in app_settings and read through a short cache. The
//   daily cron refreshes it, and a request refreshes it at once when a model
//   turns out to be gone. The owner hears when the choice changes.

import "server-only";
import { getSetting, noteOwnerOnChange, setSetting } from "@/lib/app-settings";

export type ModelChoice = {
  primary: string;
  fallback?: string;
  vision?: string;
  checkedAt?: string;
};

// Families in order of preference (regex on the model id). Models from an
// unknown future family rank after these.
const MODEL_PREFERENCE: [string, RegExp][] = [
  ["gpt-oss", /gpt-oss-120b/i],
  ["qwen", /qwen/i],
  ["llama", /llama/i],
  ["gpt-oss", /gpt-oss/i],
  ["kimi", /kimi/i],
  ["deepseek", /deepseek/i],
  ["mistral", /mistral|mixtral/i],
  ["gemma", /gemma/i],
];
// Ids that hint at image input; the catalogue doesn't list modalities, so a
// candidate is only adopted after an image probe answers.
const VISION_HINT = /vision|-vl\b|llama-4|scout|maverick|qwen3\.6|gemma-3/i;
// Text-in/text-out models that aren't chat models.
const NOT_CHAT = /guard|whisper|tts|orpheus|playai|distil/i;
const MIN_CONTEXT = 8192;
const CACHE_MS = 5 * 60 * 1000;
const SETTING = "ai_models";

const DEFAULTS: ModelChoice = { primary: "openai/gpt-oss-120b", vision: "qwen/qwen3.6-27b" };

let cache: { choice: ModelChoice; at: number } | null = null;

export function family(id: string): string {
  return MODEL_PREFERENCE.find(([, rx]) => rx.test(id))?.[0] ?? id.split("/")[0];
}

function rank(id: string): number {
  const i = MODEL_PREFERENCE.findIndex(([, rx]) => rx.test(id));
  return i === -1 ? MODEL_PREFERENCE.length : i;
}

function pinned(): ModelChoice {
  return {
    primary: process.env.AI_MODEL || DEFAULTS.primary,
    fallback: process.env.AI_FALLBACK_MODEL || undefined,
    vision: process.env.AI_VISION_MODEL || DEFAULTS.vision,
  };
}

// The models to use now: the stored choice, else the pins and defaults.
export async function currentModels(): Promise<ModelChoice> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.choice;
  let stored: ModelChoice | null = null;
  try {
    stored = await getSetting<ModelChoice>(SETTING);
  } catch {
    // The store being briefly unreachable shouldn't stop AI features.
  }
  const choice = stored?.primary ? stored : pinned();
  cache = { choice, at: Date.now() };
  return choice;
}

// Last known choice without waiting, for log and Sentry tags.
export function knownModels(): ModelChoice {
  return cache?.choice ?? pinned();
}

type Catalogue = { id: string; context_window?: number; active?: boolean }[];

export type Probe = (model: string, role: "text" | "vision") => Promise<boolean>;

export async function refreshModels(reason: string, probe: Probe): Promise<ModelChoice> {
  const key = process.env.GROQ_API_KEY;
  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const previous = await currentModels();
  if (!key) return previous;

  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Listing models failed: ${res.status}`);
  const listing = ((await res.json()) as { data?: Catalogue }).data ?? [];
  const usable = listing
    .filter((m) => m.active !== false && !NOT_CHAT.test(m.id) && (m.context_window ?? MIN_CONTEXT) >= MIN_CONTEXT)
    .map((m) => m.id)
    .sort((a, b) => rank(a) - rank(b));

  const notes: string[] = [];
  const pins = pinned();
  async function choose(
    candidates: string[],
    pin: string | undefined,
    role: "text" | "vision",
    label: string,
  ): Promise<string | undefined> {
    if (pin && process.env[label]) {
      if (!usable.includes(pin)) notes.push(`${label} (${pin}) is no longer served`);
      else if (await probe(pin, role)) return pin;
      else notes.push(`${label} (${pin}) gave no reply in a test call`);
    }
    for (const id of candidates) if (await probe(id, role)) return id;
    return undefined;
  }

  const primary = await choose(usable, pins.primary, "text", "AI_MODEL");
  if (!primary) throw new Error("No served model answered a test call");
  const otherFamily = usable.filter((id) => id !== primary && family(id) !== family(primary));
  const sameFamily = usable.filter((id) => id !== primary && family(id) === family(primary));
  const fallback = await choose([...otherFamily, ...sameFamily], pins.fallback, "text", "AI_FALLBACK_MODEL");
  const vision =
    (await choose(usable.filter((id) => VISION_HINT.test(id)), pins.vision, "vision", "AI_VISION_MODEL")) ??
    previous.vision;
  if (vision === previous.vision && !usable.includes(vision ?? "")) {
    notes.push("no served model passed the image test, so alt text keeps the last one");
  }

  const choice: ModelChoice = { primary, fallback, vision, checkedAt: new Date().toISOString() };
  await setSetting(SETTING, choice);
  cache = { choice, at: Date.now() };

  const summary = `${primary} / ${fallback ?? "none"} / ${vision ?? "none"}`;
  await noteOwnerOnChange(
    "ai-models",
    { ok: notes.length === 0, summary },
    {
      subject: `AI models: now ${primary}`,
      text: [
        `The site's AI models changed (${reason}).`,
        "",
        `Main: ${primary}`,
        `Fallback: ${fallback ?? "none"}`,
        `Images: ${vision ?? "none"}`,
        ...(notes.length ? ["", ...notes.map((n) => `Note: ${n}.`)] : []),
        "",
        "Nothing to do unless you want different ones: set AI_MODEL, AI_FALLBACK_MODEL or AI_VISION_MODEL.",
      ].join("\n"),
    },
  );
  return choice;
}
