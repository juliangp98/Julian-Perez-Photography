// Text and vision generation (server-only) through any OpenAI-compatible chat
// API. The default provider is Groq: its free tier is fast and its API policy
// doesn't train on submitted data, which is why it's used for prompts carrying
// client details. AI_BASE_URL points it elsewhere.
//
// Without GROQ_API_KEY every call returns null and AI features fall back to
// their static versions. Which model answers is decided in ./models.ts; a
// retired model falls through to the fallback, then to a fresh pick, and a
// model that's still rate-limiting after the retries hands the call to the
// fallback (another family, with its own limits on Groq's free tier). So does
// a request too large for a model's per-minute limit, and an answer that ran
// out of room before any of it was written.

import { TransientError, withRetry } from "@/lib/retry";
import { currentModels, knownModels, refreshModels } from "./models";

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const REQUEST_TIMEOUT_MS = 30_000;

export function aiEnabled(): boolean {
  return !!process.env.GROQ_API_KEY;
}

// The model last known to be in use, for log and Sentry tags.
export function aiModel(): string {
  return knownModels().primary;
}
export function visionModel(): string {
  return knownModels().vision ?? "";
}

// qwen3 and deepseek put their reasoning inline unless told not to, and accept
// `reasoning_effort: "none"`; gpt-oss keeps it separate and rejects "none";
// non-reasoning models reject the parameter. So only the first group gets it.
function silenceReasoningWithNone(model: string): boolean {
  return /qwen3|deepseek/i.test(model);
}

// gpt-oss reasons before it answers, apart from the answer, and that reasoning
// counts against max_tokens. A call that asks for `roomToReason` (a long JSON
// answer) gets this much on top of its own limit on such a model, which is
// asked to keep its reasoning short. Every other request asks for its own
// limit only, since Groq counts the requested limit, not what's used, against
// the free tier's tokens per minute.
function reasonsApart(model: string): boolean {
  return /gpt-oss/i.test(model);
}
const REASONING_ROOM = 1500;

function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type GenerateTextOptions = {
  system: string;
  // A single user prompt, or a transcript (the concierge) that takes precedence.
  prompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  // Room for reasoning on top of maxTokens, on a model that reasons apart
  // from its answer.
  roomToReason?: boolean;
};

export type DescribeImageOptions = {
  system: string;
  prompt: string;
  // A data URL (`data:image/jpeg;base64,…`) or a publicly reachable image URL.
  imageDataUrl: string;
  maxTokens?: number;
  temperature?: number;
};

type Message = { role: string; content: unknown };

class ModelGone extends Error {
  name = "ModelGone";
}

// A 429. Retried like any transient failure; one that outlasts the retries
// moves the call to the next model.
class RateLimited extends TransientError {
  name = "RateLimited";
}

// A 413: the prompt and the requested limit together exceed what the model
// takes per minute. Not retried; the call moves to the next model.
export class TooLarge extends Error {
  name = "TooLarge";
}

// The answer ran out of room before any of it was written: the model spent
// its limit reasoning. Not retried on the same model; the next one is tried,
// and when none has room the caller hears it rather than getting no answer.
export class AnswerCutOff extends Error {
  name = "AnswerCutOff";
}

async function callModel(
  model: string,
  messages: Message[],
  maxTokens: number,
  temperature: number,
  roomToReason = false,
): Promise<string | null> {
  const room = roomToReason && reasonsApart(model);
  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  return withRetry(async () => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: room ? maxTokens + REASONING_ROOM : maxTokens,
        temperature,
        ...(silenceReasoningWithNone(model) ? { reasoning_effort: "none" } : {}),
        ...(room ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      if (res.status === 404 || /model_not_found|model_decommissioned|decommissioned|does not exist/i.test(detail)) {
        throw new ModelGone(`${model}: ${detail}`);
      }
      const message = `AI provider ${res.status}: ${detail}`;
      if (res.status === 413) throw new TooLarge(`${model}: ${message}`);
      if (res.status === 429) throw new RateLimited(`${model}: ${message}`);
      if (res.status >= 500) throw new TransientError(message);
      throw new Error(message);
    }
    const json = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    } | null;
    const choice = json?.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === "string" ? stripReasoning(content) : null;
    if (!text && choice?.finish_reason === "length") {
      throw new AnswerCutOff(`${model}: the answer ran out of room before it began`);
    }
    return text;
  });
}

// Tries the chosen models in order: on to the next when one is gone, still
// rate-limited, too small for the request (413) or out of room before its
// answer began. When any is gone and none answered, picks fresh ones once;
// otherwise the error that stopped them stands, a rate limit first.
async function complete(
  role: "text" | "vision",
  messages: Message[],
  maxTokens: number,
  temperature: number,
  roomToReason = false,
): Promise<string | null> {
  if (!aiEnabled()) return null;
  const pick = async (fresh: boolean) => {
    const m = fresh ? await refreshAiModels("a model was retired") : await currentModels();
    return (role === "vision" ? [m.vision] : [m.primary, m.fallback]).filter(Boolean) as string[];
  };
  for (const fresh of [false, true]) {
    let gone: unknown;
    let limited: unknown;
    let skipped: unknown;
    for (const model of await pick(fresh)) {
      try {
        return await callModel(model, messages, maxTokens, temperature, roomToReason);
      } catch (err) {
        if (err instanceof RateLimited) limited = err;
        else if (err instanceof ModelGone) gone = err;
        else if (err instanceof TooLarge || err instanceof AnswerCutOff) skipped = err;
        else throw err;
      }
    }
    // A model that's only busy, or had no room for this request, isn't a
    // reason to re-choose the models; a retired one is, even when the other
    // is busy.
    if (limited && (fresh || !gone)) throw limited;
    if (skipped && (fresh || !gone)) throw skipped;
    if (fresh) throw gone ?? new Error("No AI model is available");
  }
  return null;
}

// Re-chooses the models from the live catalogue; the daily cron runs it too.
export function refreshAiModels(reason: string) {
  return refreshModels(reason, async (model, role) => {
    try {
      const text =
        role === "vision"
          ? await callModel(
              model,
              [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "What color is this image? One word." },
                    { type: "image_url", image_url: { url: PROBE_IMAGE } },
                  ],
                },
              ],
              200,
              0,
            )
          : await callModel(model, [{ role: "user", content: "Reply with the word ok." }], 200, 0);
      return !!text?.trim();
    } catch {
      return false;
    }
  });
}

// A 1×1 red PNG.
const PROBE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

// Returns the trimmed text, or null without a key. Throws on a provider error
// so the route can report it and show a retry message.
export function generateText(opts: GenerateTextOptions): Promise<string | null> {
  const transcript = opts.messages?.length
    ? opts.messages
    : [{ role: "user" as const, content: opts.prompt ?? "" }];
  return complete(
    "text",
    [{ role: "system", content: opts.system }, ...transcript],
    opts.maxTokens ?? 1024,
    opts.temperature ?? 0.7,
    opts.roomToReason,
  );
}

export function describeImage(opts: DescribeImageOptions): Promise<string | null> {
  return complete(
    "vision",
    [
      { role: "system", content: opts.system },
      {
        role: "user",
        content: [
          { type: "text", text: opts.prompt },
          { type: "image_url", image_url: { url: opts.imageDataUrl } },
        ],
      },
    ],
    opts.maxTokens ?? 300,
    opts.temperature ?? 0.3,
  );
}

// Pull a JSON object out of a model response, tolerating ```json fences and
// stray prose around it. Returns null when nothing parses; callers validate
// the shape before trusting it.
export function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
