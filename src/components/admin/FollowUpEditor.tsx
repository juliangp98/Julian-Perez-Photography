"use client";

// The project's next follow-up: a day and what it's for, one per project.
// Emails sent from Compose set it; here it's set, moved or cleared by hand.
// A change names the follow-up it was made against, so one set meanwhile (by
// a send in another tab) is never overwritten: the change is refused and the
// page shows the new one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import DateField from "@/components/ui/fields/DateField";
import TextField from "@/components/ui/fields/TextField";
import { formatHumanDate } from "@/lib/field-format";

const CHANGED = "That follow-up changed since this page loaded. Here's the new one.";

export default function FollowUpEditor({
  projectId,
  at,
  note,
  today,
}: {
  projectId: string;
  at?: string;
  note?: string;
  // The studio's calendar day, for whether it's due.
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // The follow-up the open editor was opened on: a change is made against it,
  // even if the page has heard of a newer one since.
  const [base, setBase] = useState<string | null>(null);
  const [day, setDay] = useState(at ?? "");
  const [text, setText] = useState(note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  function open() {
    setBase(at ?? null);
    setDay(at ?? "");
    setText(note ?? "");
    setState("idle");
    setEditing(true);
  }

  async function save(next: string | null, against: string | null) {
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          followUp: {
            at: next,
            ...(next ? { note: text.trim() } : {}),
            expect: against,
          },
        }),
      });
      if (res.status === 409) {
        setError(CHANGED);
        setState("error");
        setEditing(false);
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error("save failed");
      setState("ok");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save the follow-up. Try again.");
      setState("error");
    }
  }

  const status = (
    <FormStatus
      state={state === "ok" ? "ok" : state === "error" ? "error" : "idle"}
      error={error}
      className="block text-xs"
    />
  );

  if (editing) {
    return (
      <div className="space-y-3">
        <DateField id="follow-up-day" label="Follow up on" value={day} onChange={setDay} />
        <TextField id="follow-up-note" label="What for (optional)" value={text} onChange={setText} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(day)}
            loading={state === "saving"}
            loadingLabel="Saving…"
            onClick={() => save(day, base)}
          >
            Save follow-up
          </Button>
          <Button variant="text" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {status}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-[0.18em] text-muted">Next follow-up</div>
      {at ? (
        <p className="text-sm">
          <span>{`${formatHumanDate(at)}${note ? `: ${note}` : ""}`}</span>
          {at <= today && (
            <Badge tone={at < today ? "bad" : "warn"} className="ml-2 align-middle">
              {at < today ? "Overdue" : "Due today"}
            </Badge>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted">None set.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" onClick={open}>
          {at ? "Change" : "Set a follow-up"}
        </Button>
        {at && (
          <Button
            variant="text"
            disabled={state === "saving"}
            onClick={() => save(null, at ?? null)}
          >
            Clear
          </Button>
        )}
      </div>
      {status}
    </div>
  );
}
