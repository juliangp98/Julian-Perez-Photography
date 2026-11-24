"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

// Sends a held reply (from the owner's address, unverified) to the client.
export default function ReleaseHeldReply({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function release() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return router.refresh();
    setError((await res?.json().catch(() => null))?.error ?? "Couldn't send. Try again.");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={release} loading={busy} loadingLabel="Sending…">
        It&apos;s mine, send it to the client
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
