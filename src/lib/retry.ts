// Retry for calls that failed for a reason likely to clear on its own: a
// dropped connection, a timeout, a rate limit or a provider 5xx. Anything else
// (bad input, refused credentials) fails at once, so a real problem is never
// hidden behind waits.

// Thrown by callers for a provider response that is worth retrying (429/5xx).
export class TransientError extends Error {
  name = "TransientError";
}

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_SOCKET"]);

export function isTransient(err: unknown): boolean {
  if (err instanceof TransientError) return true;
  // fetch() rejects with a TypeError when the request never got a response.
  if (err instanceof TypeError) return true;
  const e = err as { name?: string; code?: string; cause?: { code?: string } };
  if (e?.name === "TimeoutError") return true;
  return TRANSIENT_CODES.has(e?.code ?? e?.cause?.code ?? "");
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  waitsMs: number[] = [300, 1000],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= waitsMs.length || !isTransient(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, waitsMs[attempt]));
    }
  }
}
