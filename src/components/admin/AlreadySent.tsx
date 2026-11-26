"use client";

// Beside a next step that sends a stage email: records that the email already
// went another way (written from Gmail, say), as a note in the activity log
// ("<template name> sent"), which the next step reads as sent.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";

export default function AlreadySent({ projectId, template }: { projectId: string; template: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const name = EMAIL_TEMPLATES.find((t) => t.id === template)?.name;
  if (!name) return null;

  async function mark() {
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, note: `${name} sent` }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <Button variant="text" loading={state === "saving"} loadingLabel="Saving…" onClick={mark}>
        Already sent
      </Button>
      <FormStatus state={state === "error" ? "error" : "idle"} />
    </span>
  );
}
