"use client";

// Inline "quick update" control on each admin project card: change the status
// and/or jot a status-history note without opening the full record. Collapsed by
// default to keep the board clean. Posts to /api/admin/quick-log.

import { useState } from "react";
import Select from "@/components/ui/fields/Select";
import { useRouter } from "next/navigation";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import { compactInputClass } from "@/components/ui/fields/Field";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

export default function AdminQuickLog({
  projectId,
  currentStatus,
}: {
  projectId: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const statusChanged = !!status && status !== (currentStatus ?? "");
  const canSave = statusChanged || note.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          status: statusChanged ? status : undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setNote("");
      router.refresh();
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-baseline gap-3">
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
          className="text-[10px] uppercase tracking-widest text-muted hover:text-foreground cursor-pointer bg-transparent border-0 p-0"
        >
          Quick update +
        </button>
        <FormStatus state={saved ? "ok" : "idle"} className="text-xs" />
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <Select
        density="compact"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="Status"
        className="w-full"
      >
        {CLIENT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.title}
          </option>
        ))}
      </Select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note…"
        className={`w-full ${compactInputClass}`}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!canSave} loading={busy} loadingLabel="Saving…" onClick={save}>
          Save
        </Button>
        <Button variant="text" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <FormStatus state={error ? "error" : "idle"} error={error} className="block" />
    </div>
  );
}
