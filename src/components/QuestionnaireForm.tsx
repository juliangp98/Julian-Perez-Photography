"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Field, Questionnaire } from "@/lib/questionnaires";
import {
  evaluateShowIf,
  resolvePackageOptions,
  visibleSectionsFor,
} from "@/lib/questionnaires";

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
}: {
  questionnaire: Questionnaire;
  prefill?: Record<string, string>;
}) {
  const draftKey = `questionnaire-draft-${questionnaire.slug}`;
  const [state, setState] = useState<FormState>(() => ({ ...(prefill || {}) }));
  const [sectionIndex, setSectionIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  // Preserve submitted answers for the PDF download button after localStorage is cleared.
  const submittedAnswersRef = useRef<FormState | null>(null);

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

  // Sections can be hidden by their own showIf clause (e.g. "Reception" hides
  // when the wedding Mini package is selected). We compute the visible list
  // reactively, then clamp the section index so navigation never points at a
  // section that just disappeared.
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

    // Strip hidden fields (and fields from hidden sections) from the payload
    // before sending — the server validates the same way, so anything we omit
    // here won't be required there either.
    const payload: Record<string, Value> = {};
    for (const sec of visibleSections) {
      for (const f of sec.fields) {
        if (!evaluateShowIf(f.showIf, state)) continue;
        const v = state[f.id];
        if (isFieldEmpty(f.type, v)) continue;
        payload[f.id] = v as Value;
      }
    }

    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: questionnaire.slug,
          company: state["company"] || "", // honeypot
          answers: payload,
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

  const downloadPdf = useCallback(async () => {
    if (!submittedAnswersRef.current) return;
    setPdfDownloading(true);
    try {
      const res = await fetch("/api/wedding-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "weddings",
          answers: submittedAnswersRef.current,
        }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Wedding-Day-Plan.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
    } finally {
      setPdfDownloading(false);
    }
  }, []);

  if (status === "success") {
    const isWedding = questionnaire.slug === "weddings";
    return (
      <div className="p-10 border border-[var(--accent)] rounded-lg bg-white">
        <h2 className="font-serif text-3xl">Thank you.</h2>
        <p className="mt-3 text-[var(--muted)]">
          Your answers are in my inbox. I&rsquo;ll review and reach out with next
          steps within 48 hours.
        </p>
        {isWedding && submittedAnswersRef.current && (
          <div className="mt-6 p-5 border border-[var(--border)] rounded-lg">
            <p className="text-sm font-medium">Your Wedding Day Plan</p>
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
                : "Download Wedding Day Plan (PDF)"}
            </button>
          </div>
        )}
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
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
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
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
        value={(state["company"] as string) || ""}
        onChange={(e) => update("company", e.target.value)}
      />

      <h2 className="font-serif text-3xl">{section.title}</h2>
      {section.description && (
        <p className="mt-2 text-[var(--muted)] max-w-2xl">{section.description}</p>
      )}

      <div className="mt-8 grid gap-6">
        {visibleFields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={state[field.id]}
            onChange={(v) => update(field.id, v)}
            slug={questionnaire.slug}
          />
        ))}
      </div>

      {errorMsg && (
        <div className="mt-6 text-sm text-red-700">{errorMsg}</div>
      )}

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
// Field renderer
// ----------------------------------------------------------------------------

function FieldRenderer({
  field,
  value,
  onChange,
  slug,
}: {
  field: Field;
  value: Value | undefined;
  onChange: (v: Value) => void;
  slug: string;
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
          <textarea
            id={field.id}
            rows={4}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={input}
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
      const arr = Array.isArray(value) ? value : [];
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
    // Dynamic import keeps @vercel/blob/client out of the initial client
    // bundle for pages that don't use file fields.
    const { upload } = await import("@vercel/blob/client");
    const next = [...files];
    const skipped: string[] = [];
    try {
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
        } catch {
          skipped.push(`${file.name} (upload failed)`);
        }
      }
      onChange(JSON.stringify(next));
      if (skipped.length > 0) {
        setMessage(`Skipped: ${skipped.join(", ")}`);
      }
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
      {uploading && (
        <p className="mt-2 text-xs text-[var(--muted)]">Uploading…</p>
      )}
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
      {message && (
        <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>
      )}
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        Up to {maxFiles} files, {maxSizeMb} MB each. Images and PDFs.
      </p>
      {helpEl}
    </div>
  );
}

