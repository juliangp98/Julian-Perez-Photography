"use client";

// Client-portal document upload. Uploads directly to Vercel Blob via a
// session-gated token (/api/portal/upload), then links the file to the record
// (/api/portal/attach-document). On success, refreshes so the new document
// appears in the list.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compactInputClass } from "@/components/ui/fields/Field";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/labels";

type Status = "idle" | "uploading" | "done" | "error";

export default function PortalDocumentUpload({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [kind, setKind] = useState("other");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    try {
      // Dynamic import keeps the Blob client out of the initial bundle.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`portal/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/portal/upload",
      });
      const res = await fetch("/api/portal/attach-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          url: blob.url,
          label: file.name,
          type: kind,
        }),
      });
      if (!res.ok) throw new Error("attach failed");
      setStatus("done");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        disabled={status === "uploading"}
        aria-label="Document type"
        className={compactInputClass}
      >
        {DOCUMENT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label
        htmlFor="portal-doc"
        className="inline-block px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full cursor-pointer hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
      >
        {status === "uploading" ? "Uploading…" : "Upload a document"}
      </label>
      <input
        id="portal-doc"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        onChange={onFile}
        disabled={status === "uploading"}
        className="hidden"
      />
      {status === "done" && (
        <span className="ml-4 text-sm text-[var(--muted)]">Uploaded!</span>
      )}
      {status === "error" && (
        <span role="alert" className="ml-4 text-sm text-red-700">
          Upload failed — please try again.
        </span>
      )}
    </div>
  );
}
