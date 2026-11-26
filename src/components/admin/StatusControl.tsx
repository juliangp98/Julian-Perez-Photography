"use client";

// The project's status, set by hand: the one manual control over where a
// project stands, since emails and links move it on by themselves. A new pick
// waits for Save (so moving through the list by keyboard changes nothing),
// and the select follows a status that moved elsewhere (a link added, an email
// sent). Closing a project asks first, since it clears the follow-up and the
// date hold; so does moving a closed one to another closed status, when it
// has either to clear.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/fields/Select";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { CLIENT_STATUS_OPTIONS, CLIENT_STATUS_TERMINAL, type ClientStatus } from "@/lib/client-status";

export default function StatusControl({
  projectId,
  status,
  clears = false,
}: {
  projectId: string;
  status?: string;
  // Whether the project has a follow-up or a date hold that closing clears.
  clears?: boolean;
}) {
  const router = useRouter();
  const recorded = status ?? "new-inquiry";
  const [value, setValue] = useState(recorded);
  const [seen, setSeen] = useState(recorded);
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  // What this control saved last, so a status moved elsewhere since (a link
  // added, an email sent) clears its line.
  const [savedAs, setSavedAs] = useState<string | null>(null);
  if (recorded !== seen) {
    setSeen(recorded);
    setValue(recorded);
    if (state === "error" || (state === "ok" && recorded !== savedAs)) setState("idle");
  }
  const changed = value !== recorded;

  async function save() {
    if (!changed) return;
    // The server clears the follow-up and hold on any move to a closed
    // status, so the question follows the same rule.
    const wasClosed = CLIENT_STATUS_TERMINAL.includes(recorded as ClientStatus);
    const toClosed = CLIENT_STATUS_TERMINAL.includes(value as ClientStatus);
    const ask = toClosed && (!wasClosed || clears);
    const question = wasClosed
      ? "Its follow-up and date hold are cleared. Save the new status?"
      : "Close this project? Its follow-up and date hold are cleared.";
    if (ask && !window.confirm(question)) return;
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, fields: { status: value } }),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedAs(value);
      setState("ok");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor="project-status" className="text-xs uppercase tracking-[0.18em] text-muted">
        Status
      </label>
      <Select
        id="project-status"
        density="compact"
        value={value}
        disabled={state === "saving"}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
      >
        {CLIENT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.title}
          </option>
        ))}
      </Select>
      {changed && (
        <>
          <Button size="sm" loading={state === "saving"} loadingLabel="Saving…" onClick={save}>
            Save status
          </Button>
          <Button
            variant="text"
            disabled={state === "saving"}
            onClick={() => {
              setValue(recorded);
              setState("idle");
            }}
          >
            Cancel
          </Button>
        </>
      )}
      <FormStatus
        state={state === "ok" ? "ok" : state === "error" ? "error" : "idle"}
        className="text-xs"
      />
    </div>
  );
}
