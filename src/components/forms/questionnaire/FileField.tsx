"use client";

import { useState } from "react";
import type { Field } from "@/lib/questionnaires";
import type { Value } from "./types";

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

export default function FileField({
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
          // Event-handler code, not render — the timestamp uniquifies the
          // blob filename so same-named uploads can't collide.
          // eslint-disable-next-line react-hooks/purity
          const blobName = `questionnaires/${slug}/${Date.now()}-${file.name}`;
          const blob = await upload(blobName, file, {
            access: "public",
            handleUploadUrl: "/api/questionnaire-upload",
          });
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

