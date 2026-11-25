// Transactional SMS through Twilio's Messages API (a plain fetch; the SDK isn't
// needed for one endpoint). SMS is additive to email: callers wrap it in
// try/catch and never fail the user-facing request on it.
//
// Without credentials it logs what it would have sent. Outside a production
// deploy it also only logs, unless TWILIO_BASE_URL points at a stand-in, so a
// preview or local build never texts a real client.

import { TransientError, withRetry } from "@/lib/retry";

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_FROM;
  const baseUrl = process.env.TWILIO_BASE_URL;
  const productionDeploy = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";

  if (!sid || !token || !from || (!productionDeploy && !baseUrl)) {
    console.log("[sms] not sending from this environment; would have sent:", { to, body });
    return;
  }

  const normalized = normalizeE164(to);
  if (!normalized) {
    console.warn("[sms] Skipping, phone not E.164-compatible:", to);
    return;
  }

  // 320 characters fits two GSM-7 segments, so a template change can't
  // silently turn one text into a five-segment message.
  const form = new URLSearchParams({ To: normalized, From: from, Body: body.slice(0, 320) });
  await withRetry(async () => {
    const res = await fetch(
      `${baseUrl || "https://api.twilio.com"}/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) return;
    const detail = `Twilio ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    if (res.status === 429 || res.status >= 500) throw new TransientError(detail);
    throw new Error(detail);
  });
}

// The DMV market is US-heavy, so this is a pragmatic normalization rather than
// a full validator; Twilio rejects anything malformed server-side.
//
//   "(703) 555-1234"   → "+17035551234"
//   "703-555-1234"     → "+17035551234"
//   "+1 703 555 1234"  → "+17035551234"
//   "17035551234"      → "+17035551234"
//   "555-1234"         → null (7 digits, ambiguous, skip)
function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+") && digits.length >= 11) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
