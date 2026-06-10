"use client";

// Permanently delete a project from the admin detail page. Two-step with a
// type-to-confirm gate so it can't fire by accident; on success it returns to
// the projects list.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function remove() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error();
      router.push("/admin/projects");
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm rounded-full border border-red-300 text-red-700 px-5 py-2.5 hover:bg-red-50 transition"
      >
        Delete project
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-50/50 p-5">
      <p className="text-sm">
        This permanently deletes <strong>{projectName}</strong> and can&rsquo;t
        be undone. Type <code className="font-mono">DELETE</code> to confirm.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="del-confirm" className="sr-only">
          Type DELETE to confirm
        </label>
        <input
          id="del-confirm"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
          className="px-4 py-2 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-red-400"
        />
        <button
          type="button"
          disabled={text !== "DELETE" || busy}
          onClick={remove}
          className="text-sm rounded-full bg-red-700 text-white px-5 py-2.5 hover:bg-red-800 transition disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setText("");
          }}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Couldn&rsquo;t delete — please try again.
        </p>
      )}
    </div>
  );
}
