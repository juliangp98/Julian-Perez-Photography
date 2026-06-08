"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { visibleServices as services } from "@/lib/content";
import { REFERRAL_OPTIONS } from "@/lib/referral";
import AssistedTextarea, {
  type AssistContext,
} from "@/components/AssistedTextarea";

type CallLink = { label: string; url: string };

type Status = "idle" | "submitting" | "success" | "error";

// The four fields the server requires (mirrors the zod schema in
// /api/inquire). Validated client-side so a bad submit points at the offending
// field instead of bouncing off a generic server error.
type FieldErrors = Partial<
  Record<"name" | "email" | "service" | "message", string>
>;

export default function InquiryForm({
  defaultService,
  discoveryCall,
  projectId,
  defaultName,
  defaultEmail,
  defaultPhone,
  aiEnabled = false,
}: {
  defaultService?: string;
  // Discovery-call CTA on the success screen. Passed from the parent
  // server page so the client bundle doesn't need to pull siteSettings
  // — that value is Sanity-backed and async, which a client component
  // can't await.
  discoveryCall: CallLink;
  // From a project completion link (`?project=…&fullName=…&email=…`): attach
  // this inquiry to that exact project and prefill the basics.
  projectId?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  // Whether to offer the "Help me write this" assist (threaded from the server;
  // the client can't read the AI key).
  aiEnabled?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Track referral selection so the form can reveal a follow-up text
  // field when the user picks "Other" — keeps the long tail of real
  // sources visible without cluttering the dropdown.
  const [referral, setReferral] = useState("");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Clear a single field's error as the user edits it, so a corrected field
  // stops showing red immediately.
  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // Snapshot the sibling fields at draft time so the assist is grounded in what
  // the visitor has already filled in (service, date, venue, budget, name).
  function assistContext(): AssistContext {
    const form = formRef.current;
    if (!form) return {};
    const fd = new FormData(form);
    const str = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" ? v.trim() : "";
    };
    const details: { label: string; value: string }[] = [];
    const serviceSlug = str("service");
    const serviceTitle =
      services.find((s) => s.slug === serviceSlug)?.title || serviceSlug;
    if (serviceTitle) details.push({ label: "Service", value: serviceTitle });
    const add = (k: string, lbl: string) => {
      const v = str(k);
      if (v) details.push({ label: lbl, value: v });
    };
    add("eventDate", "Event date");
    add("location", "Location / venue");
    add("budget", "Budget");
    return { clientName: str("name") || undefined, details };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const val = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" ? v.trim() : "";
    };

    // Client-side validation: catch the required fields before the round-trip
    // so the message points at the field, not the whole form.
    const nextErrors: FieldErrors = {};
    if (!val("name")) nextErrors.name = "Please enter your name.";
    const email = val("email");
    if (!email) nextErrors.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      nextErrors.email = "Please enter a valid email address.";
    if (!val("service")) nextErrors.service = "Please choose a service.";
    if (!val("message"))
      nextErrors.message = "Please tell me a little about your vision.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus("idle");
      setErrorMsg(null);
      const firstInvalid = (
        ["name", "email", "service", "message"] as const
      ).find((k) => nextErrors[k]);
      if (firstInvalid) {
        const el = formEl.querySelector<HTMLElement>(
          `[name="${firstInvalid}"]`,
        );
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setErrors({});
    setStatus("submitting");
    setErrorMsg(null);

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
      formEl.reset();
      setMessage("");
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
          <Link
            href="/questionnaire"
            className="underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Browse planning questionnaires →
          </Link>
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
        <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
          <p className="text-sm font-medium">Track your project</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Sign in to your client portal anytime to check your status, add
            details, and find your documents — just use this same email, no
            password needed.
          </p>
          <Link
            href="/portal"
            className="mt-3 inline-block px-5 py-2 border border-[var(--foreground)] rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Open your portal &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const input =
    "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
  const inputError = "border-red-500 focus:border-red-500";
  const label = "block text-sm font-medium mb-1.5";
  const fieldClass = (field: keyof FieldErrors) =>
    `${input} ${errors[field] ? inputError : ""}`.trim();

  // Red asterisk marking a required field; the visible legend below explains it.
  const Req = () => (
    <span className="text-red-600" aria-hidden="true">
      {" "}
      *
    </span>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="hp_company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      {projectId && (
        <input type="hidden" name="project" defaultValue={projectId} />
      )}

      <p className="text-xs text-[var(--muted)]">
        <span className="text-red-600">*</span> Required
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className={label}>
            Name
            <Req />
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={defaultName}
            onInput={() => clearError("name")}
            aria-invalid={!!errors.name || undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={fieldClass("name")}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-700">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email
            <Req />
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            defaultValue={defaultEmail}
            onInput={() => clearError("email")}
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={fieldClass("email")}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-700">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="phone" className={label}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={defaultPhone}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="service" className={label}>
            Service
            <Req />
          </label>
          <select
            id="service"
            name="service"
            defaultValue={defaultService || ""}
            onChange={() => clearError("service")}
            aria-invalid={!!errors.service || undefined}
            aria-describedby={errors.service ? "service-error" : undefined}
            className={fieldClass("service")}
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
          {errors.service && (
            <p id="service-error" className="mt-1 text-sm text-red-700">
              {errors.service}
            </p>
          )}
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
            Budget
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
          <Req />
        </label>
        <AssistedTextarea
          id="message"
          name="message"
          rows={6}
          required
          value={message}
          onChange={(v) => {
            setMessage(v);
            clearError("message");
          }}
          textareaClassName={fieldClass("message")}
          invalid={!!errors.message}
          errorId={errors.message ? "message-error" : undefined}
          assist={{
            kind: "inquiry",
            question: "Tell me about your vision",
            enabled: aiEnabled,
            getContext: assistContext,
          }}
        />
        {errors.message && (
          <p id="message-error" className="mt-1 text-sm text-red-700">
            {errors.message}
          </p>
        )}
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
