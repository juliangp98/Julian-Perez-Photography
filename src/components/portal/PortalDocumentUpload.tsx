"use client";

// Client-portal document upload: the shared UploadButton sends the file to
// Vercel Blob, then it is linked to the project through
// /api/portal/attach-document under the chosen kind, and the page refreshes to
// list it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/fields/Select";
import UploadButton from "@/components/ui/UploadButton";
import FormStatus from "@/components/ui/FormStatus";
import { CLIENT_DOCUMENT_TYPES } from "@/lib/labels";

type Status = "idle" | "uploading" | "done" | "error";

export default function PortalDocumentUpload({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  // Opens on "General", the catch-all kind.
  const [kind, setKind] = useState("other");

  async function attach(file: { url: string; name: string }) {
    const res = await fetch("/api/portal/attach-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        url: file.url,
        label: file.name,
        type: kind,
      }),
    });
    if (!res.ok) throw new Error("attach failed");
    setStatus("done");
    router.refresh();
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
        {CLIENT_DOCUMENT_TYPES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <UploadButton
        onStart={() => setStatus("uploading")}
        onUploaded={attach}
        onError={() => setStatus("error")}
      >
        Upload a document
      </UploadButton>
      <FormStatus
        state={status === "done" ? "ok" : status}
        ok="Uploaded!"
        error="Upload failed. Try again."
        className="ml-4"
      />
    </div>
  );
}
