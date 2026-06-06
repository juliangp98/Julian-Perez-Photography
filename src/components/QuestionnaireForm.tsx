"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssistedTextarea, {
  type AssistContext,
} from "@/components/AssistedTextarea";
import Link from "next/link";
import type { Field, Questionnaire } from "@/lib/questionnaires";
import {
  evaluateShowIf,
  resolvePackageOptions,
  visibleSectionsFor,
} from "@/lib/questionnaires";
import {
  bundleSiblings,
  prefillableFieldIds,
} from "@/lib/questionnaire-bundles";
import { serviceNoun } from "@/lib/project-name";
import type { SiteSettings } from "@/lib/types";
import { REFERRAL_OPTIONS } from "@/lib/referral";

// Three of the four Square call URLs (post-questionnaire wrap-up needs
// everything except the top-of-funnel discovery call). Taken from
// `SiteSettings["calls"]` so the shape can't drift from the parent.
type QuestionnaireCalls = Pick<
  SiteSettings["calls"],
  "planningCall" | "weddingTimelineCall" | "venueWalkthrough"
>;

type Status = "idle" | "submitting" | "success" | "error";
type Value = string | string[];
type FormState = Record<string, Value>;

// Shared emptiness check — file fields store a JSON array as a string, so a
// raw empty-string check isn't enough and `"[]"` also counts as empty.
function isFieldEmpty(type: string, v: Value | undefined): boolean {
  if (v === undefined || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (type === "file" && typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return !Array.isArray(parsed) || parsed.length === 0;
    } catch {
      return true;
    }
  }
  return false;
}

export default function QuestionnaireForm({
  questionnaire,
  prefill,
  calls,
  projectId,
  aiEnabled = false,
}: {
  questionnaire: Questionnaire;
  prefill?: Record<string, string | string[]>;
  // Call-booking CTAs shown on the success screen. Passed from the
  // parent server page so the client bundle doesn't pull siteSettings
  // (Sanity-backed and async — not awaitable from a client component).
  calls: QuestionnaireCalls;
  // Optional project id (from a completion link's `?project=`) so the
  // submission attaches to that exact project rather than matching by email.
  projectId?: string;
  // Whether to offer the "Help me write this" assist on textarea fields.
  aiEnabled?: boolean;
}) {
  const draftKey = `questionnaire-draft-${questionnaire.slug}`;
  const [state, setState] = useState<FormState>(() => ({ ...(prefill || {}) }));
  const [sectionIndex, setSectionIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Displayed beneath the Download / Preview buttons on the success
  // screen when a PDF generation attempt fails. Separate from the form's
  // primary `errorMsg` so a post-submit PDF hiccup doesn't overwrite
  // the submission's own status.
  const [pdfErrorMsg, setPdfErrorMsg] = useState<string | null>(null);
  // Preserve submitted answers for the PDF download button after localStorage is cleared.
  const submittedAnswersRef = useRef<FormState | null>(null);

  // Build the assist context from answers given so far — excluding the field
  // being drafted, file uploads, and empties — so the writing assistant is
  // grounded in what the client already told us. Labels come from the schema so
  // the model sees "Venue: The Manor", not a field id.
  function assistContext(excludeId: string): AssistContext {
    const details: { label: string; value: string }[] = [];
    for (const section of questionnaire.sections) {
      for (const f of section.fields) {
        if (f.id === excludeId || f.type === "file") continue;
        const v = state[f.id];
        if (isFieldEmpty(f.type, v)) continue;
        details.push({
          label: f.label,
          value: Array.isArray(v) ? v.join(", ") : String(v),
        });
      }
    }
    return { details };
  }

  // Restore draft on mount, then layer prefill on top so query params always win.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as FormState;
        setState((prev) => ({ ...draft, ...prev, ...(prefill || {}) }));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave to localStorage.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(state));
      } catch {
        // ignore quota errors
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, draftKey, hydrated]);

  // Sections can be hidden by their own showIf clause (e.g. "Reception"
  // hides when the wedding Mini package is selected). The visible list
  // is computed reactively, then the section index is clamped so
  // navigation never points at a section that just disappeared.
  const visibleSections = useMemo(
    () => visibleSectionsFor(questionnaire, state),
    [questionnaire, state],
  );
  const safeIndex = Math.min(sectionIndex, Math.max(visibleSections.length - 1, 0));
  useEffect(() => {
    if (safeIndex !== sectionIndex) setSectionIndex(safeIndex);
  }, [safeIndex, sectionIndex]);

  const section = visibleSections[safeIndex] ?? questionnaire.sections[0];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === visibleSections.length - 1;

  // Resolve which fields in the current section are visible (showIf logic).
  const visibleFields = useMemo(
    () => section.fields.filter((f) => evaluateShowIf(f.showIf, state)),
    [section, state],
  );

  function update(id: string, value: Value) {
    setState((prev) => ({ ...prev, [id]: value }));
  }

  function validateCurrentSection(): string | null {
    for (const f of visibleFields) {
      if (!f.required) continue;
      const v = state[f.id];
      if (isFieldEmpty(f.type, v)) {
        return `Please answer: ${f.label}`;
      }
    }
    return null;
  }

  function next() {
    const err = validateCurrentSection();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }
    setErrorMsg(null);
    setStatus("idle");
    setSectionIndex((i) => Math.min(i + 1, visibleSections.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prev() {
    setErrorMsg(null);
    setStatus("idle");
    setSectionIndex((i) => Math.max(i - 1, 0));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const err = validateCurrentSection();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }

    // Strip hidden fields (and fields from hidden sections) from the
    // payload before sending — the server validates the same way, so
    // anything omitted here won't be required there either.
    const payload: Record<string, Value> = {};
    for (const sec of visibleSections) {
      for (const f of sec.fields) {
        if (!evaluateShowIf(f.showIf, state)) continue;
        const v = state[f.id];
        if (isFieldEmpty(f.type, v)) continue;
        payload[f.id] = v as Value;
      }
    }
    // `referralOther` isn't declared in the questionnaire schema — it's a
    // companion field that only appears when the referral dropdown is set
    // to "Other". Include it in the payload when present so Julian sees
    // the long-tail source in his email.
    if (payload.referral === "other" && typeof state.referralOther === "string" && state.referralOther) {
      payload.referralOther = state.referralOther;
    }

    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: questionnaire.slug,
          // Honeypot — keyed `hp_company` to match the route + the inquiry
          // convention (previously sent as `company`, which the route ignored).
          hp_company: state["hp_company"] || "",
          answers: payload,
          project: projectId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      submittedAnswersRef.current = payload;
      setStatus("success");
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // PDF generation is supported for the slugs that have a paired
  // /api/<slug>-plan route + a React-PDF document component. Each entry
  // maps a questionnaire slug to its route, output filename, and
  // user-facing plan label. Adding a third PDF (e.g. cultural-milestones
  // someday) is a one-line append plus a new route + component pair.
  const PDF_PLANS: Record<
    string,
    { route: string; filename: string; label: string }
  > = {
    weddings: {
      route: "/api/wedding-plan",
      filename: "Wedding-Day-Plan.pdf",
      label: "Wedding Day Plan",
    },
    "wedding-films": {
      route: "/api/wedding-films-plan",
      filename: "Wedding-Films-Plan.pdf",
      label: "Wedding Films Plan",
    },
  };
  const pdfPlan = PDF_PLANS[questionnaire.slug];

  // Cross-prefill into bundle siblings is computed in the success block below
  // (see `src/lib/questionnaire-bundles.ts`).

  // Mid-form PDF preview. Validates required fields across every visible
  // section (not just the current one, so clients don't get a half-empty
  // plan), then opens the rendered PDF in a new tab. Pure read-side —
  // no state mutation, no submission side-effects, and the PDF route
  // never sends email.
  const previewPdf = useCallback(async () => {
    if (!pdfPlan) return;
    // Build the same payload submit() would, but without side effects.
    const payload: Record<string, Value> = {};
    for (const sec of visibleSections) {
      for (const f of sec.fields) {
        if (!evaluateShowIf(f.showIf, state)) continue;
        const v = state[f.id];
        if (isFieldEmpty(f.type, v)) {
          if (f.required) {
            // Jump to the offending section and surface the message.
            const targetIdx = visibleSections.findIndex((s) => s === sec);
            if (targetIdx !== -1) setSectionIndex(targetIdx);
            setErrorMsg(`Please answer: ${f.label}`);
            setStatus("error");
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
            return;
          }
          continue;
        }
        payload[f.id] = v as Value;
      }
    }

    setPreviewLoading(true);
    try {
      const res = await fetch(pdfPlan.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: questionnaire.slug,
          answers: payload,
        }),
      });
      if (!res.ok) throw new Error("PDF preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Keep the blob alive briefly so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("PDF preview error:", err);
      setErrorMsg("Couldn't generate the preview — please try again.");
      setStatus("error");
    } finally {
      setPreviewLoading(false);
    }
  }, [visibleSections, state, pdfPlan, questionnaire.slug]);

  const downloadPdf = useCallback(async () => {
    if (!submittedAnswersRef.current || !pdfPlan) return;
    setPdfDownloading(true);
    // Clear any previous error message so a fresh attempt starts with a
    // clean slate. The surfaced error below replaces whatever was there.
    setPdfErrorMsg(null);
    try {
      const res = await fetch(pdfPlan.route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: questionnaire.slug,
          answers: submittedAnswersRef.current,
        }),
      });
      if (!res.ok) {
        // Attempt to parse the JSON envelope (`{ error }`) for a
        // server-supplied message; fall back to a generic line if the
        // body isn't JSON or the key is missing.
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfPlan.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      setPdfErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't generate the PDF. Please try again, or reply to the confirmation email and I'll send it over.",
      );
    } finally {
      setPdfDownloading(false);
    }
  }, [pdfPlan, questionnaire.slug]);

  if (status === "success") {
    const isWedding = questionnaire.slug === "weddings";
    // Cross-prefill into bundle siblings: each sibling button carries every
    // answer that sibling's form also asks for \u2014 the intersection of what was
    // answered and what the target asks, matched by canonical field id. No
    // per-pair field list; the harmonized IDs across questionnaires make it work
    // (file uploads are excluded since they can't ride a query string).
    const answers = submittedAnswersRef.current;
    const siblingLinks = answers
      ? bundleSiblings(questionnaire.slug).map((sib) => {
          const fields = prefillableFieldIds(sib);
          const params = new URLSearchParams();
          for (const [id, value] of Object.entries(answers)) {
            if (!fields.has(id)) continue;
            if (typeof value === "string" && value) {
              params.set(id, value);
            } else if (Array.isArray(value)) {
              // Multi-select answers ride along as repeated keys.
              for (const item of value) if (item) params.append(id, item);
            }
          }
          return {
            slug: sib,
            noun: serviceNoun(sib) ?? sib,
            href: `/questionnaire/${sib}?${params.toString()}`,
          };
        })
      : [];
    return (
      <div className="p-10 border border-[var(--accent)] rounded-lg bg-white">
        <h2 className="font-serif text-3xl">Thank you.</h2>
        <p className="mt-3 text-[var(--muted)]">
          Your answers are in my inbox. I&rsquo;ll review and reach out with next
          steps within 48 hours.
        </p>
        {pdfPlan && submittedAnswersRef.current && (
          <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
            <p className="text-sm font-medium">Your {pdfPlan.label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              A PDF copy was also sent to your email.
            </p>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfDownloading}
              className="mt-3 px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {pdfDownloading
                ? "Generating PDF\u2026"
                : `Download ${pdfPlan.label} (PDF)`}
            </button>
            {pdfErrorMsg && (
              <p
                role="alert"
                className="mt-3 text-sm text-red-700"
              >
                {pdfErrorMsg}
              </p>
            )}
          </div>
        )}
        <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
          <p className="text-sm font-medium">Track your project</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Everything you just shared is saved to your project. Sign in to your
            client portal anytime to check your status, add more detail, and
            find your documents &mdash; same email, no password.
          </p>
          <Link
            href="/portal"
            className="mt-3 inline-block px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90 transition"
          >
            Open your portal &rarr;
          </Link>
        </div>
        {siblingLinks.length > 0 && (
          <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
            <p className="text-sm font-medium">Booking more than one session?</p>
            <p className="mt-1 mb-3 text-xs text-[var(--muted)]">
              Continue into a matching questionnaire &mdash; the details you just
              shared arrive prefilled, so you won&rsquo;t retype them.
            </p>
            <div className="flex flex-wrap gap-3">
              {siblingLinks.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  className="inline-block px-5 py-2 border border-[var(--foreground)] rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
                >
                  Continue planning your {s.noun.toLowerCase()} &rarr;
                </Link>
              ))}
            </div>
          </div>
        )}
        {/* Call booking CTAs */}
        <div className="mt-6 p-5 border border-[var(--border)] rounded-lg space-y-4">
          <div>
            <p className="text-sm font-medium">Ready to hop on a call?</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Now that I have your answers, a quick call lets us align on the
              details. Pick the one that fits.
            </p>
          </div>
          <a
            href={calls.planningCall.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90 transition"
          >
            {calls.planningCall.label} &rarr;
          </a>
          {isWedding && (
            <div className="flex gap-3 flex-wrap">
              <a
                href={calls.weddingTimelineCall.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 border border-[var(--foreground)] rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
              >
                {calls.weddingTimelineCall.label} &rarr;
              </a>
              <a
                href={calls.venueWalkthrough.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 border border-[var(--foreground)] rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
              >
                {calls.venueWalkthrough.label} &rarr;
              </a>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Link
            href={`/services/${questionnaire.slug}`}
            className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
          >
            Back to pricing
          </Link>
          <Link
            href="/"
            className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress / step indicator — counts only currently-visible sections so
          the denominator stays accurate when scope-narrowing branches drop
          sections out of the flow. */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          aria-live="polite"
          aria-atomic="true"
        >
          Section {safeIndex + 1} of {visibleSections.length}
        </div>
        <div className="text-xs text-[var(--muted)]">
          ~{questionnaire.estimatedMinutes} min total
        </div>
      </div>
      <div className="h-1 w-full bg-[var(--border)] rounded-full overflow-hidden mb-10">
        <div
          className="h-full bg-[var(--accent)] transition-all"
          style={{
            width: `${((safeIndex + 1) / Math.max(visibleSections.length, 1)) * 100}%`,
          }}
        />
      </div>

      {/* Honeypot — hidden from users, must stay empty */}
      <input
        type="text"
        name="hp_company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
        value={(state["hp_company"] as string) || ""}
        onChange={(e) => update("hp_company", e.target.value)}
      />

      <h2 className="font-serif text-3xl">{section.title}</h2>
      {section.description && (
        <p className="mt-2 text-[var(--muted)] max-w-2xl">{section.description}</p>
      )}

      <div className="mt-8 grid gap-6">
        {visibleFields.map((field) => {
          // Normalize the "How did you find me?" field into the curated
          // dropdown used across the site — regardless of what `type` the
          // questionnaire JSON declares for it. The "Other" option reveals
          // a sibling free-text input (`referralOther`) so long-tail
          // sources still come through.
          if (field.id === "referral") {
            return (
              <ReferralField
                key={field.id}
                field={field}
                value={state.referral as string | undefined}
                otherValue={state.referralOther as string | undefined}
                onChange={(v) => update("referral", v)}
                onOtherChange={(v) => update("referralOther", v)}
              />
            );
          }
          return (
            <FieldRenderer
              key={field.id}
              field={field}
              value={state[field.id]}
              onChange={(v) => update(field.id, v)}
              slug={questionnaire.slug}
              aiEnabled={aiEnabled}
              getAssistContext={() => assistContext(field.id)}
            />
          );
        })}
      </div>

      {/* aria-live so the error announces when it changes — the user
          doesn't need to tab back to find out why submit was blocked. */}
      <div
        role="alert"
        aria-live="polite"
        className="mt-6 text-sm text-red-700 min-h-[1.25rem]"
      >
        {errorMsg || null}
      </div>

      <div className="mt-10 flex gap-3 flex-wrap">
        {!isFirst && (
          <button
            type="button"
            onClick={prev}
            className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            ← Previous
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            onClick={next}
            className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
          >
            Next →
          </button>
        )}
        {isLast && (
          <button
            type="button"
            onClick={submit}
            disabled={status === "submitting"}
            className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-60"
          >
            {status === "submitting" ? "Sending…" : "Submit questionnaire"}
          </button>
        )}
        {isLast && pdfPlan && (
          <button
            type="button"
            onClick={previewPdf}
            disabled={previewLoading || status === "submitting"}
            className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm disabled:opacity-60"
            title={`Open a PDF preview of your ${pdfPlan.label} in a new tab`}
          >
            {previewLoading ? "Generating preview…" : "Preview my plan (PDF)"}
          </button>
        )}
      </div>

      {hydrated && (
        <p className="mt-6 text-xs text-[var(--muted)]">
          Your answers autosave in this browser. You can close the tab and come
          back.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Referral field — curated dropdown with an "Other" free-text fallback.
// Rendered in place of the generic text renderer for the `referral` field so
// the inquiry + questionnaire data stays normalized site-wide.
// ----------------------------------------------------------------------------

function ReferralField({
  field,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  field: Field;
  value: string | undefined;
  otherValue: string | undefined;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
}) {
  const input =
    "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
  const label = "block text-sm font-medium mb-1.5";
  return (
    <div>
      <label htmlFor={field.id} className={label}>
        {field.label}
        {field.required && <span className="text-[var(--accent)]"> *</span>}
      </label>
      <select
        id={field.id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={input}
      >
        {REFERRAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value === "other" && (
        <input
          id="referralOther"
          name="referralOther"
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Tell me more (optional)"
          className={`${input} mt-2`}
        />
      )}
      {field.help && (
        <p className="mt-1.5 text-xs text-[var(--muted)]">{field.help}</p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Field renderer
// ----------------------------------------------------------------------------

function FieldRenderer({
  field,
  value,
  onChange,
  slug,
  aiEnabled,
  getAssistContext,
}: {
  field: Field;
  value: Value | undefined;
  onChange: (v: Value) => void;
  slug: string;
  aiEnabled?: boolean;
  getAssistContext?: () => AssistContext;
}) {
  const input =
    "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
  const label = "block text-sm font-medium mb-1.5";

  const labelEl = (
    <label htmlFor={field.id} className={label}>
      {field.label}
      {field.required && <span className="text-[var(--accent)]"> *</span>}
    </label>
  );
  const helpEl = field.help ? (
    <p className="mt-1.5 text-xs text-[var(--muted)]">{field.help}</p>
  ) : null;

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
      return (
        <div>
          {labelEl}
          <input
            id={field.id}
            type={field.type === "text" ? "text" : field.type}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={input}
          />
          {helpEl}
        </div>
      );
    case "number":
      return (
        <div>
          {labelEl}
          <input
            id={field.id}
            type="number"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            min={0}
            className={input}
          />
          {helpEl}
        </div>
      );
    case "date":
      return (
        <div>
          {labelEl}
          <input
            id={field.id}
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={input}
          />
          {helpEl}
        </div>
      );
    case "time":
      return (
        <div>
          {labelEl}
          <input
            id={field.id}
            type="time"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={input}
          />
          {helpEl}
        </div>
      );
    case "textarea":
      return (
        <div>
          {labelEl}
          <AssistedTextarea
            id={field.id}
            rows={4}
            value={(value as string) || ""}
            onChange={(v) => onChange(v)}
            placeholder={field.placeholder}
            textareaClassName={input}
            assist={{
              kind: "questionnaire",
              question: field.label,
              service: slug,
              enabled: !!aiEnabled,
              getContext: getAssistContext,
            }}
          />
          {helpEl}
        </div>
      );
    case "select":
      return (
        <div>
          {labelEl}
          <select
            id={field.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={input}
          >
            <option value="" disabled>
              Select…
            </option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {helpEl}
        </div>
      );
    case "radio":
      return (
        <div>
          {labelEl}
          <div className="grid gap-2 mt-1">
            {(field.options || []).map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-3 cursor-pointer text-sm"
              >
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="mt-1"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {helpEl}
        </div>
      );
    case "checkbox": {
      // A single-checkbox URL prefill arrives as a lone string (Next returns a
      // string, not an array, for a non-repeated key) — wrap it so it checks.
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <div>
          {labelEl}
          <div className="grid gap-2 mt-1">
            {(field.options || []).map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-3 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  value={opt}
                  checked={arr.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, opt]);
                    else onChange(arr.filter((v) => v !== opt));
                  }}
                  className="mt-1"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {helpEl}
        </div>
      );
    }
    case "package": {
      const opts = resolvePackageOptions(slug);
      return (
        <div>
          {labelEl}
          <select
            id={field.id}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={input}
          >
            <option value="" disabled>
              Select a package…
            </option>
            {opts.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {helpEl}
        </div>
      );
    }
    case "file":
      return (
        <FileField
          field={field}
          value={value}
          onChange={onChange}
          slug={slug}
          labelEl={labelEl}
          helpEl={helpEl}
        />
      );
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// File field — uploads to Vercel Blob on selection so the form submit payload
// stays JSON. State holds a JSON-encoded `{ url, name, size }[]`.
// ----------------------------------------------------------------------------

type UploadedFile = { url: string; name: string; size: number };

function parseFiles(value: Value | undefined): UploadedFile[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is UploadedFile =>
        f && typeof f.url === "string" && typeof f.name === "string",
    );
  } catch {
    return [];
  }
}

function FileField({
  field,
  value,
  onChange,
  slug,
  labelEl,
  helpEl,
}: {
  field: Field;
  value: Value | undefined;
  onChange: (v: Value) => void;
  slug: string;
  labelEl: React.ReactNode;
  helpEl: React.ReactNode;
}) {
  const files = parseFiles(value);
  const maxFiles = field.maxFiles ?? 10;
  const maxSizeMb = field.maxFileSizeMb ?? 10;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setMessage(null);
    setUploading(true);
    // The whole body runs inside try/catch/finally: the dynamic import
    // below can throw on a chunk-load failure, and per-file uploads can
    // throw on network errors. Either class of error should leave the
    // UI in a consistent state (button re-enabled, message shown) rather
    // than an unhandled rejection.
    try {
      // Dynamic import keeps @vercel/blob/client out of the initial
      // client bundle for pages that don't use file fields.
      const { upload } = await import("@vercel/blob/client");
      const next = [...files];
      const skipped: string[] = [];
      let added = 0;
      for (const file of Array.from(selected)) {
        if (next.length >= maxFiles) {
          skipped.push(`${file.name} (limit ${maxFiles})`);
          continue;
        }
        if (file.size > maxSizeBytes) {
          skipped.push(`${file.name} (over ${maxSizeMb} MB)`);
          continue;
        }
        try {
          const blob = await upload(
            `questionnaires/${slug}/${Date.now()}-${file.name}`,
            file,
            {
              access: "public",
              handleUploadUrl: "/api/questionnaire-upload",
            },
          );
          next.push({ url: blob.url, name: file.name, size: file.size });
          added += 1;
        } catch {
          skipped.push(`${file.name} (upload failed)`);
        }
      }
      onChange(JSON.stringify(next));
      // Summarize for screen-reader announcement. A spoken "Uploaded 2
      // files" is much more useful than silent state changes.
      const parts: string[] = [];
      if (added > 0) parts.push(`Uploaded ${added} file${added === 1 ? "" : "s"}.`);
      if (skipped.length > 0) parts.push(`Skipped: ${skipped.join(", ")}`);
      setMessage(parts.length > 0 ? parts.join(" ") : null);
    } catch (err) {
      console.error("[questionnaire] file upload failed:", err);
      setMessage(
        "The uploader couldn't load. Please refresh and try again, or attach files to the confirmation email once it arrives.",
      );
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    const next = files.filter((_, j) => j !== i);
    onChange(JSON.stringify(next));
  }

  return (
    <div>
      {labelEl}
      <input
        id={field.id}
        type="file"
        multiple
        disabled={uploading}
        accept={field.accept || "image/*,application/pdf"}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = ""; // reset so selecting the same file twice re-fires
        }}
        className="block w-full text-sm text-[var(--muted)] file:mr-3 file:px-4 file:py-2 file:border-0 file:rounded-full file:bg-[var(--foreground)] file:text-[var(--background)] hover:file:opacity-90 file:cursor-pointer file:disabled:opacity-60"
      />
      {/* Single live region for the uploader so screen readers announce
          in-progress uploads and summary results without the user
          having to hunt for status text. */}
      <div
        role="status"
        aria-live="polite"
        className="mt-2 text-xs text-[var(--muted)] min-h-[1rem]"
      >
        {uploading ? "Uploading…" : message || null}
      </div>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {files.map((f, i) => (
            <li key={f.url} className="flex justify-between items-center gap-3">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 truncate text-[var(--foreground)] hover:text-[var(--accent)]"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        Up to {maxFiles} files, {maxSizeMb} MB each. Images and PDFs.
      </p>
      {helpEl}
    </div>
  );
}

