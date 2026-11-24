"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <button
        type="button"
        onClick={release}
        disabled={busy}
        className="px-4 py-1.5 text-xs bg-foreground text-background rounded-full hover:opacity-90 transition disabled:opacity-50"
      >
        {busy ? "Sending…" : "It's mine, send it to the client"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
