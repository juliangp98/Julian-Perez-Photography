"use client";

// The project's status, set by hand: the one manual control over where a
// project stands, since emails and links move it on by themselves. Saves as
// soon as a new one is picked, and follows a status that moved elsewhere
// (a link added, an email sent). Closing a project asks first, since it
// clears the follow-up and the date hold.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/fields/Select";
import FormStatus from "@/components/ui/FormStatus";
import { CLIENT_STATUS_OPTIONS, CLIENT_STATUS_TERMINAL, type ClientStatus } from "@/lib/client-status";

export default function StatusControl({
  projectId,
  status,
}: {
  projectId: string;
  status?: string;
}) {
  const router = useRouter();
  const recorded = status ?? "new-inquiry";
  const [value, setValue] = useState(recorded);
  const [seen, setSeen] = useState(recorded);
  if (recorded !== seen) {
    setSeen(recorded);
    setValue(recorded);
  }
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle");

  async function change(next: string) {
    if (next === value) return;
    const closing =
      CLIENT_STATUS_TERMINAL.includes(next as ClientStatus) &&
      !CLIENT_STATUS_TERMINAL.includes(value as ClientStatus);
    if (closing && !window.confirm("Close this project? Its follow-up and date hold are cleared.")) {
      return;
    }
    const before = value;
    setValue(next);
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, fields: { status: next } }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("ok");
      router.refresh();
    } catch {
      setValue(before);
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label htmlFor="project-status" className="text-xs uppercase tracking-[0.18em] text-muted">
        Status
      </label>
      <Select
        id="project-status"
        density="compact"
        value={value}
        disabled={state === "saving"}
        onChange={(e) => change(e.target.value)}
      >
        {CLIENT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.title}
          </option>
        ))}
      </Select>
      <FormStatus
        state={state === "ok" ? "ok" : state === "error" ? "error" : "idle"}
        className="text-xs"
      />
    </div>
  );
}
