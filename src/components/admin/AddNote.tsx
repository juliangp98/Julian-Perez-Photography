"use client";

// Adds a dated note to the project's activity log (/api/admin/update).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { inputClass, labelClass } from "@/components/ui/fields/Field";

export default function AddNote({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setState("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, note: note.trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      setNote("");
      setState("ok");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={add} className="space-y-2">
      <label htmlFor="activity-note" className={labelClass}>
        Add a note <span className="font-normal text-muted">(private)</span>
      </label>
      <textarea
        id="activity-note"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          if (state !== "saving") setState("idle");
        }}
        className={inputClass}
      />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={!note.trim()}
          loading={state === "saving"}
          loadingLabel="Adding…"
        >
          Add note
        </Button>
        <FormStatus
          state={state === "ok" ? "ok" : state === "error" ? "error" : "idle"}
          ok="Added."
          error="Couldn't add the note. Try again."
        />
      </div>
    </form>
  );
}
