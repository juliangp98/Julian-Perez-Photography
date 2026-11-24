"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AssistedTextarea, { type AssistContext } from "@/components/forms/AssistedTextarea";
import { inputClass } from "@/components/ui/fields/Field";

// The client's side of the thread: write to Julian from the portal. It lands
// on the project's thread and in his inbox.
export default function PortalMessageBox({
  projectId,
  aiEnabled,
  service,
  assistContext,
}: {
  projectId: string;
  aiEnabled: boolean;
  service?: string;
  assistContext: AssistContext;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || state === "sending") return;
    setState("sending");
    const res = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body }),
    }).catch(() => null);
    if (res?.ok) {
      setBody("");
      setState("sent");
      router.refresh();
      return;
    }
    setError((await res?.json().catch(() => null))?.error ?? "Couldn't send. Try again.");
    setState("error");
  }

  return (
    <form onSubmit={send} className="mt-5 space-y-3">
      <AssistedTextarea
        id="portal-message"
        rows={4}
        value={body}
        onChange={(v) => {
          setBody(v);
          if (state !== "sending") setState("idle");
        }}
        placeholder="Write to Julian…"
        textareaClassName={inputClass}
        assist={{
          kind: "portal-note",
          question: "A message or question for your photographer",
          service,
          enabled: aiEnabled,
          getContext: () => assistContext,
        }}
      />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending" || !body.trim()}
          className="px-6 py-3 bg-foreground text-background rounded-full hover:opacity-90 transition disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        {state === "sent" && (
          <span role="status" className="text-sm text-muted">
            Sent. Julian gets it by email too.
          </span>
        )}
        {state === "error" && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
