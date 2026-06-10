"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { visibleServices as services } from "@/lib/content";
import { REFERRAL_OPTIONS } from "@/lib/referral";
import AssistedTextarea, {
  type AssistContext,
} from "@/components/forms/AssistedTextarea";
import Field, { controlClass } from "@/components/ui/fields/Field";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import PhoneField from "@/components/ui/fields/PhoneField";
import DateField from "@/components/ui/fields/DateField";
import BudgetField from "@/components/ui/fields/BudgetField";
import LocationField from "@/components/ui/fields/LocationField";
import { formatPhone, isValidEmail } from "@/lib/field-format";
import Panel from "@/components/ui/Panel";

import Button from "@/components/ui/Button";
type CallLink = { label: string; url: string };
type Status = "idle" | "submitting" | "success" | "error";

// The four fields the server requires (mirrors the zod schema in /api/inquire).
type FieldKey = "name" | "email" | "service" | "message";
type FieldErrors = Partial<Record<FieldKey, string>>;

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
  discoveryCall: CallLink;
  projectId?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  aiEnabled?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [v, setV] = useState({
    name: defaultName ?? "",
    email: defaultEmail ?? "",
    phone: formatPhone(defaultPhone ?? ""),
    service: defaultService ?? "",
    eventDate: "",
    location: "",
    budget: "",
    referral: "",
    referralOther: "",
  });
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const set =
    <K extends keyof typeof v>(k: K) =>
    (val: string) =>
      setV((prev) => ({ ...prev, [k]: val }));

  function clearError(field: FieldKey) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // Snapshot the sibling fields so the writing assistant is grounded in what the
  // visitor already filled in.
  function assistContext(): AssistContext {
    const details: { label: string; value: string }[] = [];
    const serviceTitle =
      services.find((s) => s.slug === v.service)?.title || v.service;
    if (serviceTitle) details.push({ label: "Service", value: serviceTitle });
    if (v.eventDate) details.push({ label: "Event date", value: v.eventDate });
    if (v.location)
      details.push({ label: "Location / venue", value: v.location });
    if (v.budget) details.push({ label: "Budget", value: v.budget });
    return { clientName: v.name || undefined, details };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation: catch the required fields before the round-trip so
    // the message points at the field, not the whole form.
    const next: FieldErrors = {};
    if (!v.name.trim()) next.name = "Please enter your name.";
    if (!v.email.trim()) next.email = "Please enter your email address.";
    else if (!isValidEmail(v.email))
      next.email = "Please enter a valid email address.";
    if (!v.service.trim()) next.service = "Please choose a service.";
    if (!message.trim())
      next.message = "Please tell me a little about your vision.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      setStatus("idle");
      setErrorMsg(null);
      const firstId: Record<FieldKey, string> = {
        name: "inq-name",
        email: "inq-email",
        service: "inq-service",
        message: "message",
      };
      const first = (["name", "email", "service", "message"] as const).find(
        (k) => next[k],
      );
      if (first) {
        const el = document.getElementById(firstId[first]);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setErrors({});
    setStatus("submitting");
    setErrorMsg(null);

    // Honeypot is read from the DOM (a bot fills the input directly, which never
    // touches React state), not from `v`.
    const hp = formRef.current
      ? String(new FormData(formRef.current).get("hp_company") || "")
      : "";
    const payload: Record<string, string | undefined> = {
      name: v.name,
      email: v.email,
      phone: v.phone,
      service: v.service,
      eventDate: v.eventDate,
      location: v.location,
      budget: v.budget,
      referral: v.referral,
      message,
      hp_company: hp,
      project: projectId,
    };
    if (v.referral === "other" && v.referralOther) {
      payload.referralOther = v.referralOther;
    }

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
      setV((prev) => ({
        ...prev,
        phone: "",
        eventDate: "",
        location: "",
        budget: "",
        referral: "",
        referralOther: "",
      }));
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
        <Panel className="mt-6">
          <p className="text-sm font-medium">Want to chat first?</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            A quick discovery call is the easiest way to see if we&rsquo;re a
            good fit. No commitment, no pressure.
          </p>
          <Button href={discoveryCall.url} external className="mt-3">
            {discoveryCall.label} &rarr;
          </Button>
        </Panel>
        <Panel className="mt-6">
          <p className="text-sm font-medium">Track your project</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Sign in to your client portal anytime to check your status, add
            details, and find your documents — just use this same email, no
            password needed.
          </p>
          <Button href="/portal" variant="secondary" className="mt-3">
            Open your portal &rarr;
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5" noValidate>
      {/* Honeypot — read from the DOM on submit, never via React state. */}
      <input
        type="text"
        name="hp_company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <p className="text-xs text-[var(--muted)]">
        <span className="text-[var(--accent)]">*</span> Required
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        <TextField
          id="inq-name"
          label="Name"
          required
          value={v.name}
          onChange={(val) => {
            set("name")(val);
            clearError("name");
          }}
          error={errors.name}
          autoComplete="name"
        />
        <EmailField
          id="inq-email"
          label="Email"
          required
          value={v.email}
          onChange={(val) => {
            set("email")(val);
            clearError("email");
          }}
          error={errors.email}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <PhoneField
          id="inq-phone"
          value={v.phone}
          onChange={set("phone")}
        />
        <SelectField
          id="inq-service"
          label="Service"
          required
          error={errors.service}
          value={v.service}
          onChange={(val) => {
            set("service")(val);
            clearError("service");
          }}
          placeholder="Select a service…"
          options={services.map((s) => ({ value: s.slug, label: s.title }))}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <DateField
          id="inq-date"
          label="Event date (if known)"
          value={v.eventDate}
          onChange={set("eventDate")}
        />
        <LocationField
          id="inq-location"
          label="Location / venue"
          value={v.location}
          onChange={set("location")}
          valueKind="address"
          placeholder="Search a venue or address…"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <BudgetField id="inq-budget" value={v.budget} onChange={set("budget")} />
        <SelectField
          id="inq-referral"
          label="How did you hear about me?"
          value={v.referral}
          onChange={set("referral")}
          options={REFERRAL_OPTIONS}
        >
          {v.referral === "other" && (
            <input
              id="inq-referralOther"
              value={v.referralOther}
              onChange={(e) => set("referralOther")(e.target.value)}
              placeholder="Tell me more (optional)"
              className={`${controlClass(false)} mt-2`}
            />
          )}
        </SelectField>
      </div>

      <Field
        id="message"
        label="Tell me about your vision"
        required
        error={errors.message}
      >
        <AssistedTextarea
          id="message"
          name="message"
          rows={6}
          value={message}
          onChange={(val) => {
            setMessage(val);
            clearError("message");
          }}
          invalid={!!errors.message}
          errorId={errors.message ? "message-error" : undefined}
          textareaClassName={controlClass(!!errors.message)}
          assist={{
            kind: "inquiry",
            question: "Tell me about your vision",
            enabled: aiEnabled,
            getContext: assistContext,
          }}
        />
      </Field>

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
