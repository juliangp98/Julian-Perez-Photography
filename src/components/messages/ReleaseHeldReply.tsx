"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

// Sends a held reply (from the owner's address, unverified) to the client and
// says so on the spot; the refreshed thread then marks the held copy as sent
// after review.
export default function ReleaseHeldReply({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function release() {
    setState("sending");
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    }).catch(() => null);
    if (res?.ok) {
      setState("ok");
      router.refresh();
      return;
    }
    setError((await res?.json().catch(() => null))?.error ?? "Couldn't send. Try again.");
    setState("error");
  }

  if (state === "ok") {
    return <FormStatus state="ok" ok="Sent to the client." className="mt-3 block" />;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={release} loading={state === "sending"} loadingLabel="Sending…">
        It&apos;s mine, send it to the client
      </Button>
      <FormStatus state={state} error={error} className="text-xs" />
    </div>
  );
}
