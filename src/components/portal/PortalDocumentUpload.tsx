"use client";

// Client-portal document upload: straight to Vercel Blob via a session-gated
// token (/api/portal/upload), then linked to the record through
// /api/portal/attach-document, and the page refreshes to list it.

import { useRef, useState } from "react";
import Select from "@/components/ui/fields/Select";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
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
      <Select
        density="compact"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        disabled={status === "uploading"}
        aria-label="Document type"
      >
        {DOCUMENT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <label
        htmlFor="portal-doc"
        className={`${buttonClass("secondary", "md")} cursor-pointer`}
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
      <FormStatus
        state={status === "done" ? "ok" : status}
        ok="Uploaded!"
        error="Upload failed. Try again."
        className="ml-4"
      />
    </div>
  );
}
