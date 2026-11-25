"use client";

import { useState } from "react";

// The request plumbing every AI panel shares: POST a body, keep the result,
// and say plainly when it fails. `pick` reads the result from the route's JSON
// and returns null when the route had nothing to do (AI off, nothing to read).
// `initial` is a result the page already has (one saved on the project), and
// `keepOnEmpty` keeps the shown result when a run comes back with nothing;
// otherwise an empty answer clears it, so nothing stale stays on screen.
export function useAiAction<T>(
  url: string,
  pick: (json: Record<string, unknown>) => T | null | undefined,
  { initial = null, keepOnEmpty = false }: { initial?: T | null; keepOnEmpty?: boolean } = {},
) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<T | null>(initial);
  const [error, setError] = useState("");

  async function run(body: unknown): Promise<T | null> {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That didn't work. Try again.");
        setStatus("error");
        return null;
      }
      const value = pick(json) ?? null;
      if (value || !keepOnEmpty) setResult(value);
      setStatus(value ? "done" : "idle");
      return value;
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
      setStatus("error");
      return null;
    }
  }

  return { run, status, result, setResult, error };
}
