"use client";

import { useState } from "react";
import { visibleServices as services } from "@/lib/content";

type Status = "idle" | "submitting" | "success" | "error";

export default function InquiryForm({ defaultService }: { defaultService?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        name="company"
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
          <input id="referral" name="referral" className={input} />
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

      {status === "error" && (
        <div className="text-sm text-red-700">{errorMsg}</div>
      )}

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
