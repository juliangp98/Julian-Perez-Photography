"use client";

// Passwordless sign-in: posts an email to `endpoint` (portal by default, admin
// passes its own), which mails a magic link. The reply is uniform to avoid
// enumeration; in dev it carries a `devLink`, shown as a clickable link.

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

type Status = "idle" | "sending" | "sent" | "error";

export default function PortalLoginForm({
  endpoint = "/api/portal/request-link",
  sentMessage = "Check your email. If that address matches a record, a secure sign-in link is on its way. It expires in 20 minutes.",
  next,
}: {
  endpoint?: string;
  sentMessage?: string;
  // The page to open after signing in (the portal's link carries it).
  next?: string;
} = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setDevLink(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, hp_company: "", ...(next ? { next } : {}) }),
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
      <div className="p-6 border border-border rounded-lg bg-white">
        <p className="text-sm leading-relaxed">{sentMessage}</p>
        {devLink && (
          <p className="mt-4 text-xs text-muted break-all">
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
          className="w-full px-4 py-3 rounded border border-border bg-white focus:outline-none focus:border-foreground transition"
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
      <Button
        type="submit"
        size="lg"
        loading={status === "sending"}
        loadingLabel="Sending…"
      >
        Send my sign-in link
      </Button>
      <FormStatus
        state={status}
        error="Something went wrong. Try again."
        className="block"
      />
    </form>
  );
}
