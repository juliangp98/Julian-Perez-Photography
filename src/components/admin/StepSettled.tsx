"use client";

// Beside the project's next step, for work done outside the site: Already
// sent (a stage email written from Gmail, say), which notes it in the log and
// moves the project on as sending it would, or Mark handled (a client's
// message answered another way), which marks the Today row it shares. It
// lives as long as the project's page, so its confirmation stays on screen
// when the next step it brings in has no such button.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { composeDraft } from "@/components/admin/compose-draft";

export default function StepSettled({
  projectId,
  sent,
  handled,
}: {
  projectId: string;
  // The template sent another way.
  sent?: string;
  // The Today row key of the message answered another way.
  handled?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  // What was settled last, and what this step offers to settle.
  const [settled, setSettled] = useState<{ key: string; sent: boolean } | null>(null);
  const key = sent ? `sent:${sent}` : handled ? `handled:${handled}` : "";

  async function settle() {
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sent ? { id: projectId, sent } : { id: projectId, dismiss: { key: handled } },
        ),
      });
      if (!res.ok) throw new Error("save failed");
      // An email left unsent on that template has gone another way.
      if (sent) composeDraft.dropTemplate(projectId, sent);
      setSettled({ key, sent: !!sent });
      setState("ok");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  const offer = !!key && settled?.key !== key;
  if (!offer && state !== "ok" && state !== "error") return null;
  return (
    <span className="inline-flex items-center gap-3">
      {offer && (
        <Button variant="text" loading={state === "saving"} loadingLabel="Saving…" onClick={settle}>
          {sent ? "Already sent" : "Mark handled"}
        </Button>
      )}
      <FormStatus state={state} ok={settled?.sent ? "Noted as sent." : "Marked handled."} />
    </span>
  );
}
