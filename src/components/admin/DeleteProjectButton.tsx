"use client";

// Permanently delete a project from the admin detail page. Two-step with a
// type-to-confirm gate so it can't fire by accident; on success it returns to
// the projects list.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import FormStatus from "@/components/ui/FormStatus";

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
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete project
      </Button>
    );
  }

  return (
    <Panel tone="danger">
      <p className="text-sm">
        This permanently deletes <strong>{projectName}</strong>
        {" and can’t be undone. Type "}
        <code className="font-mono">DELETE</code>
        {" to confirm."}
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
          className="px-4 py-2 rounded border border-border bg-white text-sm focus:outline-none focus:border-danger/60"
        />
        <Button
          variant="danger"
          disabled={text !== "DELETE"}
          loading={busy}
          loadingLabel="Deleting…"
          onClick={remove}
        >
          Delete permanently
        </Button>
        <Button
          variant="text"
          onClick={() => {
            setConfirming(false);
            setText("");
          }}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <FormStatus state="error" error="Couldn't delete. Try again." className="mt-3 block" />
      )}
    </Panel>
  );
}
