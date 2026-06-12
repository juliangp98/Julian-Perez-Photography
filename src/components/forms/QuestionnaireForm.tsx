"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssistContext } from "@/components/forms/AssistedTextarea";
import ReferralField from "@/components/forms/questionnaire/ReferralField";
import FieldRenderer from "@/components/forms/questionnaire/FieldRenderer";
import type { Value } from "@/components/forms/questionnaire/types";
import type { Questionnaire } from "@/lib/questionnaires";
import { evaluateShowIf, visibleSectionsFor } from "@/lib/questionnaires";
import {
  bundleSiblings,
  prefillableFieldIds,
} from "@/lib/questionnaire-bundles";
import { serviceNoun } from "@/lib/project-name";
import type { SiteSettings } from "@/lib/types";
import Panel from "@/components/ui/Panel";

import Button from "@/components/ui/Button";
// Three of the four Square call URLs (post-questionnaire wrap-up needs
// everything except the top-of-funnel discovery call). Taken from
// `SiteSettings["calls"]` so the shape can't drift from the parent.
type QuestionnaireCalls = Pick<
  SiteSettings["calls"],
  "planningCall" | "weddingTimelineCall" | "venueWalkthrough"
>;

type Status = "idle" | "submitting" | "success" | "error";
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
  const [submittedAnswers, setSubmittedAnswers] = useState<FormState | null>(
    null,
  );

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
        // Mount-only localStorage hydration — state can't be seeded during SSR
        // without a hydration mismatch, so the one-time post-mount set is the
        // sanctioned pattern here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Clamp after the visible-sections list shrinks (a showIf hid the current
    // section). Render already uses safeIndex, so the extra pass is a no-op
    // visually — it only re-syncs the stored index.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setSubmittedAnswers(payload);
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
    if (!submittedAnswers || !pdfPlan) return;
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
          answers: submittedAnswers,
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
  }, [pdfPlan, questionnaire.slug, submittedAnswers]);

  if (status === "success") {
    const isWedding = questionnaire.slug === "weddings";
    // Cross-prefill into bundle siblings: each sibling button carries every
    // answer that sibling's form also asks for \u2014 the intersection of what was
    // answered and what the target asks, matched by canonical field id. No
    // per-pair field list; the harmonized IDs across questionnaires make it work
    // (file uploads are excluded since they can't ride a query string).
    const answers = submittedAnswers;
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
        {pdfPlan && submittedAnswers && (
          <Panel className="mt-6">
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
          </Panel>
        )}
        <Panel className="mt-6">
          <p className="text-sm font-medium">Track your project</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Everything you just shared is saved to your project. Sign in to your
            client portal anytime to check your status, add more detail, and
            find your documents &mdash; same email, no password.
          </p>
          <Button href="/portal" className="mt-3">
            Open your portal &rarr;
          </Button>
        </Panel>
        {siblingLinks.length > 0 && (
          <Panel className="mt-6">
            <p className="text-sm font-medium">Booking more than one session?</p>
            <p className="mt-1 mb-3 text-xs text-[var(--muted)]">
              Continue into a matching questionnaire &mdash; the details you just
              shared arrive prefilled, so you won&rsquo;t retype them.
            </p>
            <div className="flex flex-wrap gap-3">
              {siblingLinks.map((s) => (
                <Button key={s.slug} href={s.href} variant="secondary">
                  Continue planning your {s.noun.toLowerCase()} &rarr;
                </Button>
              ))}
            </div>
          </Panel>
        )}
        {/* Call booking CTAs */}
        <Panel className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium">Ready to hop on a call?</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Now that I have your answers, a quick call lets us align on the
              details. Pick the one that fits.
            </p>
          </div>
          <Button href={calls.planningCall.url} external>
            {calls.planningCall.label} &rarr;
          </Button>
          {isWedding && (
            <div className="flex gap-3 flex-wrap">
              <Button href={calls.weddingTimelineCall.url} external variant="secondary">
                {calls.weddingTimelineCall.label} &rarr;
              </Button>
              <Button href={calls.venueWalkthrough.url} external variant="secondary">
                {calls.venueWalkthrough.label} &rarr;
              </Button>
            </div>
          )}
        </Panel>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Button href={`/services/${questionnaire.slug}`} variant="secondary">
            Back to pricing
          </Button>
          <Button href="/" variant="secondary">
            Home
          </Button>
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
