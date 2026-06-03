"use client";

// Inline "quick update" control on each admin project card: change the status
// and/or jot a status-history note without opening the full record. Collapsed by
// default to keep the board clean. Posts to /api/admin/quick-log.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";

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
  const [error, setError] = useState(false);
  const [notifyClient, setNotifyClient] = useState(false);

  const statusChanged = !!status && status !== (currentStatus ?? "");
  const canSave = statusChanged || note.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          status: statusChanged ? status : undefined,
          note: note.trim() || undefined,
          notifyClient: notifyClient || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setNote("");
      setOpen(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer bg-transparent border-0 p-0"
      >
        Quick update +
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full px-3 py-2 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)]"
      >
        {CLIENT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.title}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note…"
        className="w-full px-3 py-2 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)]"
      />
      <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={notifyClient}
          onChange={(e) => setNotifyClient(e.target.checked)}
        />
        Email the client
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={save}
          className="px-4 py-1.5 text-xs bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer bg-transparent border-0"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          Couldn&rsquo;t save — please try again.
        </p>
      )}
    </div>
  );
}
