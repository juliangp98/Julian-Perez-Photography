// Thin Twilio wrapper for transactional SMS confirmations.
//
// Mirrors the Resend "dev-mode fallback" pattern used throughout the API
// routes: if env vars are absent, log what we would have sent and return
// successfully so local development works without a Twilio account.
//
// SMS is strictly additive to the existing email flow — callers should
// always wrap this in try/catch and never let failure propagate into the
// user-facing response. Email already succeeded by the time we get here.

import twilio from "twilio";

export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_FROM;

  if (!sid || !token || !from) {
    console.log("[sms] Twilio not configured — would have sent:", { to, body });
    return;
  }

  const normalized = normalizeE164(to);
  if (!normalized) {
    console.warn("[sms] Skipping — phone not E.164-compatible:", to);
    return;
  }

  const client = twilio(sid, token);
  // Hard cap at 320 chars so a future template change can't silently
  // produce multi-segment messages that cost 5× as much. 320 fits comfortably
  // in 2 GSM-7 segments (160 chars each) with a safety margin.
  await client.messages.create({
    to: normalized,
    from,
    body: body.slice(0, 320),
  });
}

// US-heavy DMV market — skip libphonenumber-js and do a pragmatic
// normalization. Twilio itself rejects malformed numbers server-side, so
// this is a best-effort pass, not a full validator.
//
//   "(703) 555-1234"   → "+17035551234"
//   "703-555-1234"     → "+17035551234"
//   "+1 703 555 1234"  → "+17035551234"
//   "17035551234"      → "+17035551234"
//   "555-1234"         → null (7 digits — ambiguous, skip)
function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+") && digits.length >= 11) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
