"use client";

import { useState } from "react";
import { visibleServices as services } from "@/lib/content";
import { REFERRAL_OPTIONS } from "@/lib/referral";

type CallLink = { label: string; url: string };

type Status = "idle" | "submitting" | "success" | "error";

export default function InquiryForm({
  defaultService,
  discoveryCall,
}: {
  defaultService?: string;
  // Discovery-call CTA on the success screen. Passed from the parent
  // server page so the client bundle doesn't need to pull siteSettings
  // — after round 14a that value is Sanity-backed + async, which a
  // client component can't await.
  discoveryCall: CallLink;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Track referral selection so we can reveal a follow-up text field when
  // the user picks "Other" — keeps the long tail of real sources visible
  // without cluttering the dropdown.
  const [referral, setReferral] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/inquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (status === "success") {
    return (
      <div className="p-10 border border-[var(--accent)] rounded-lg bg-white">
        <h2 className="font-serif text-3xl">Thank you.</h2>
        <p className="mt-3 text-[var(--muted)]">
          Your inquiry is in my inbox. I&rsquo;ll reply within 48 hours — often
          faster.
        </p>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Once we&rsquo;re booked (or if you&rsquo;re seriously considering),
          the next step is a planning questionnaire so I can show up prepared.{" "}
          <a
            href="/questionnaire"
            className="underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Browse planning questionnaires →
          </a>
        </p>
        <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
          <p className="text-sm font-medium">Want to chat first?</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            A quick discovery call is the easiest way to see if we&rsquo;re a
            good fit. No commitment, no pressure.
          </p>
          <a
            href={discoveryCall.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90 transition"
          >
            {discoveryCall.label} &rarr;
          </a>
        </div>
      </div>
    );
  }

  const input =
    "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
  const label = "block text-sm font-medium mb-1.5";

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="hp_company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className={label}>
            Name
          </label>
          <input id="name" name="name" required className={input} />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            className={input}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="phone" className={label}>
            Phone (optional)
          </label>
          <input id="phone" name="phone" className={input} />
        </div>
        <div>
          <label htmlFor="service" className={label}>
            Service
          </label>
          <select
            id="service"
            name="service"
            defaultValue={defaultService || ""}
            className={input}
            required
          >
            <option value="" disabled>
              Select a service…
            </option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="eventDate" className={label}>
            Event date (if known)
          </label>
          <input
            id="eventDate"
            type="date"
            name="eventDate"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="location" className={label}>
            Location / venue
          </label>
          <input id="location" name="location" className={input} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="budget" className={label}>
            Budget (optional)
          </label>
          <input
            id="budget"
            name="budget"
            placeholder="e.g. $2,500 – $3,500"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="referral" className={label}>
            How did you hear about me?
          </label>
          <select
            id="referral"
            name="referral"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            className={input}
          >
            {REFERRAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {referral === "other" && (
            <input
              id="referralOther"
              name="referralOther"
              placeholder="Tell me more (optional)"
              className={`${input} mt-2`}
            />
          )}
        </div>
      </div>

      <div>
        <label htmlFor="message" className={label}>
          Tell me about your vision
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          className={input}
        />
      </div>

      {/* role="alert" + aria-live so screen readers announce submission
          failures without requiring the user to tab back to the error. */}
      <div role="alert" aria-live="polite" className="text-sm text-red-700">
        {status === "error" ? errorMsg : null}
      </div>

      <div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Send inquiry"}
        </button>
      </div>
    </form>
  );
}
