// Stand-ins for Resend, the OpenAI-compatible AI provider and Twilio. The app
// under test reaches them through RESEND_BASE_URL, AI_BASE_URL and
// TWILIO_BASE_URL (see playwright.config.ts), so no spec can reach a real
// provider. Specs read what was sent from GET /__calls and steer replies with
// POST /__script; DELETE /__calls resets everything.
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_PROVIDERS_PORT || 4010);

const DEFAULT_MODELS = [
  { id: "openai/gpt-oss-120b", context_window: 131072 },
  { id: "qwen/qwen3-32b", context_window: 131072 },
  { id: "llama-3.1-8b-instant", context_window: 131072 },
  { id: "qwen/qwen3.6-27b", context_window: 131072 },
  { id: "meta-llama/llama-guard-4-12b", context_window: 131072 },
  { id: "whisper-large-v3", context_window: 448 },
].map((m) => ({ object: "model", owned_by: m.id.split("/")[0], active: true, ...m }));

const DEFAULT_REPLY = "Subject: Draft from the test provider\n\nA reply from the test provider.";

function fresh() {
  return {
    calls: [],
    emails: new Map(),
    inbound: new Map(),
    idempotency: new Map(),
    script: { replies: [], models: null, retired: [] },
  };
}
let state = fresh();
let seq = 0;

const notFound = [404, { statusCode: 404, name: "not_found", message: "Not found" }];

const routes = [
  ["POST", /^\/emails$/, "resend", (body, headers) => {
    const to = [].concat(body?.to ?? []);
    if (to.some((a) => String(a).endsWith("@fail.test"))) {
      return [422, { statusCode: 422, name: "validation_error", message: "The recipient was rejected." }];
    }
    const key = headers["idempotency-key"];
    if (key && state.idempotency.has(key)) return [200, { id: state.idempotency.get(key) }];
    const id = `fake-email-${++seq}`;
    state.emails.set(id, { ...body, id, created_at: new Date().toISOString(), last_event: "delivered" });
    if (key) state.idempotency.set(key, id);
    return [200, { id }];
  }],
  ["GET", /^\/emails$/, "resend", () => [200, { object: "list", has_more: false, data: [...state.emails.values()] }]],
  ["GET", /^\/emails\/receiving\/([^/]+)$/, "resend", (_, __, [id]) =>
    state.inbound.has(id) ? [200, { object: "email", ...state.inbound.get(id) }] : notFound],
  ["GET", /^\/emails\/([^/]+)$/, "resend", (_, __, [id]) =>
    state.emails.has(id) ? [200, { object: "email", ...state.emails.get(id) }] : notFound],
  ["GET", /^\/domains$/, "resend", () =>
    [200, { object: "list", data: [{ id: "fake-domain", name: "example.test", status: "verified" }] }]],
  ["GET", /^\/models$/, "ai", () => [200, { object: "list", data: state.script.models ?? DEFAULT_MODELS }]],
  ["POST", /^\/chat\/completions$/, "ai", (body) => {
    if (state.script.retired.includes(body?.model)) {
      return [404, { error: { message: `The model \`${body.model}\` has been decommissioned.`, type: "invalid_request_error", code: "model_decommissioned" } }];
    }
    const content = state.script.replies.length ? state.script.replies.shift() : DEFAULT_REPLY;
    return [200, {
      id: `fake-chat-${++seq}`,
      object: "chat.completion",
      model: body?.model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    }];
  }],
  ["POST", /^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/, "twilio", (body) =>
    String(body?.To ?? "").endsWith("0000")
      ? [400, { code: 21211, message: "The 'To' number is not a valid phone number." }]
      : [201, { sid: `SMfake${++seq}`, status: "queued", to: body?.To }]],
];

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return null;
  const type = req.headers["content-type"] ?? "";
  if (type.includes("json")) return JSON.parse(raw);
  if (type.includes("x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function reply(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body ?? {}));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const body = await readBody(req).catch(() => null);

  if (url.pathname === "/__health") return reply(res, 200, { ok: true });
  if (url.pathname === "/__calls" && req.method === "DELETE") {
    state = fresh();
    return reply(res, 200, { ok: true });
  }
  if (url.pathname === "/__calls") {
    const provider = url.searchParams.get("provider");
    return reply(res, 200, state.calls.filter((c) => !provider || c.provider === provider));
  }
  if (url.pathname === "/__script" && req.method === "POST") {
    state.script = { ...state.script, ...body };
    return reply(res, 200, { ok: true });
  }
  if (url.pathname === "/__inbound" && req.method === "POST") {
    state.inbound.set(body.id, body);
    return reply(res, 200, { ok: true });
  }

  for (const [method, pattern, provider, handle] of routes) {
    const match = req.method === method && url.pathname.match(pattern);
    if (!match) continue;
    state.calls.push({ provider, method, path: url.pathname, headers: req.headers, body });
    const [status, payload] = handle(body, req.headers, match.slice(1));
    return reply(res, status, payload);
  }
  reply(res, 404, { error: `No fake for ${req.method} ${url.pathname}` });
}).listen(PORT, () => console.log(`[fake-providers] listening on :${PORT}`));
