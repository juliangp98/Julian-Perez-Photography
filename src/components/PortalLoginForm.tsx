"use client";

// Passwordless sign-in form for the client portal. Posts an email to
// /api/portal/request-link, which emails a one-time magic link. The response
// is deliberately uniform (no enumeration), so the success state says "if that
// email matches…" regardless. In dev, the route returns a `devLink` so the
// loop can be completed without a mail provider — surfaced here as a clickable
// link.

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setDevLink(null);
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, hp_company: "" }),
      });
      const data = (await res.json().catch(() => null)) as
        | { devLink?: string }
        | null;
      if (data?.devLink) setDevLink(data.devLink);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="p-6 border border-[var(--border)] rounded-lg bg-white">
        <p className="text-sm leading-relaxed">
          Check your email — if that address matches a record, a secure sign-in
          link is on its way. It expires in 20 minutes.
        </p>
        {devLink && (
          <p className="mt-4 text-xs text-[var(--muted)] break-all">
            Dev link:{" "}
            <a className="underline" href={devLink}>
              {devLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="portal-email"
          className="block text-sm font-medium mb-1.5"
        >
          Email
        </label>
        <input
          id="portal-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition"
        />
      </div>
      {/* Honeypot — kept empty; bots that fill it are silently ignored. */}
      <input
        type="text"
        name="hp_company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value=""
        onChange={() => {}}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send my sign-in link"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Something went wrong — please try again.
        </p>
      )}
    </form>
  );
}
