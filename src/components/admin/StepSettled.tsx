"use client";

// Beside the project's next step, for work done outside the site: Already
// sent (a stage email written from Gmail, say), which notes it in the log and
// moves the project on as sending it would, or Mark handled (a client's
// message answered another way), which marks the Today row it shares. Either
// confirms itself and stays done until the page shows the next step.

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
  if (!sent && !handled) return null;

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
      setState("ok");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <Button
        variant="text"
        disabled={state === "ok"}
        loading={state === "saving"}
        loadingLabel="Saving…"
        onClick={settle}
      >
        {sent ? "Already sent" : "Mark handled"}
      </Button>
      <FormStatus state={state} ok={sent ? "Noted as sent." : "Marked handled."} />
    </span>
  );
}
