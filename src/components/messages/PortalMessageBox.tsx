"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AssistedTextarea, { type AssistContext } from "@/components/forms/AssistedTextarea";
import { inputClass } from "@/components/ui/fields/Field";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

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
        <Button
          type="submit"
          size="lg"
          disabled={!body.trim()}
          loading={state === "sending"}
          loadingLabel="Sending…"
        >
          Send
        </Button>
        <FormStatus
          state={state === "sent" ? "ok" : state}
          ok="Sent. I'll see it in my email too."
          error={error}
        />
      </div>
    </form>
  );
}
