// Provider-agnostic text generation (server-only). A single `generateText`
// call fronts any OpenAI-compatible chat-completions API; the default provider
// is Groq, whose free tier is fast and — per their API policy — does not train
// on submitted data, which is why it's the pick for anything carrying client
// PII. Swappable to OpenAI / Together / Fireworks / any compatible endpoint by
// pointing `AI_BASE_URL` (+ `AI_MODEL`) at it.
//
// The whole module no-ops (returns null) when `GROQ_API_KEY` is unset, so AI
// features degrade to their static fallback instead of erroring — the same
// optional-by-env posture as Resend and Twilio. The key is read server-side
// only and must never be exposed as `NEXT_PUBLIC_`.

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
// The text default isn't multimodal — vision uses a separate, vision-capable
// model (override with AI_VISION_MODEL; Groq's lineup changes over time). Groq
// keeps no stable production vision model — its multimodal offerings ride the
// Llama 4 line, so expect to revisit this when the current one is retired.
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";
const REQUEST_TIMEOUT_MS = 30_000;

// Whether AI features are configured. UI uses this to decide whether to offer
// the AI affordance at all (rather than show a button that no-ops).
export function aiEnabled(): boolean {
  return !!process.env.GROQ_API_KEY;
}

// The model in effect (default or env override) — handy for logs / tags.
export function aiModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

// The vision model in effect (default or env override).
export function visionModel(): string {
  return process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL;
}

// Groq's reasoning models (qwen3, gpt-oss, deepseek-r1, …) emit a chain of
// thought before their answer. For terse single-shot outputs like alt text we
// want only the answer, so reasoning is turned off per request via
// `reasoning_effort: "none"`. That parameter is REJECTED by non-reasoning
// models (e.g. the Llama vision models), so it's sent only when the model id
// matches a known reasoning family — letting AI_VISION_MODEL be pointed at
// either kind without a code change.
function isReasoningModel(model: string): boolean {
  return /qwen3|gpt-oss|deepseek/i.test(model);
}

// Strip any `<think>…</think>` block a reasoning model may still emit inline,
// leaving just the answer. A no-op for models that don't reason.
function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type GenerateTextOptions = {
  system: string;
  // Most callers pass a single user `prompt`. Multi-turn callers (the public
  // concierge) pass a `messages` transcript instead; when set it takes
  // precedence over `prompt`.
  prompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
};

// Generate a completion from the configured provider. Returns the trimmed text,
// or null when no key is configured (caller falls back). Throws on a provider
// error (non-2xx, timeout, malformed response) so the route can log it to
// Sentry and surface a retry message — a thrown error is never a silent drop.
export async function generateText(
  opts: GenerateTextOptions,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );
  const model = aiModel();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          ...(opts.messages?.length
            ? opts.messages
            : [{ role: "user" as const, content: opts.prompt ?? "" }]),
        ],
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure or timeout — normalize to a single error shape.
    throw new Error(
      `AI request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI provider ${res.status}: ${detail.slice(0, 500)}`);
  }

  const json: unknown = await res.json().catch(() => null);
  const content = (json as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}

export type DescribeImageOptions = {
  system: string;
  prompt: string;
  // A data URL (`data:image/jpeg;base64,…`) or a publicly reachable image URL.
  imageDataUrl: string;
  maxTokens?: number;
  temperature?: number;
};

// Vision completion: describe an image for the given prompt (e.g. generate alt
// text). Same posture as `generateText` — returns trimmed text, null without a
// key, throws on a provider error — but sends a multimodal message and uses the
// vision model (`AI_VISION_MODEL`), since the text default isn't multimodal.
export async function describeImage(
  opts: DescribeImageOptions,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel(),
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: [
              { type: "text", text: opts.prompt },
              { type: "image_url", image_url: { url: opts.imageDataUrl } },
            ],
          },
        ],
        max_tokens: opts.maxTokens ?? 300,
        temperature: opts.temperature ?? 0.3,
        // Reasoning models would otherwise spend the token budget thinking
        // out loud; alt text wants the answer directly.
        ...(isReasoningModel(visionModel())
          ? { reasoning_effort: "none" }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `AI vision request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI vision provider ${res.status}: ${detail.slice(0, 500)}`);
  }

  const json: unknown = await res.json().catch(() => null);
  const content = (json as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  return typeof content === "string" ? stripReasoning(content) : null;
}

// Pull a JSON object out of a model response, tolerating ```json code fences and
// stray prose around it (models often wrap structured output). Returns the
// parsed value, or null when nothing parseable is found — callers then validate
// the shape (e.g. with zod) before trusting it.
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
