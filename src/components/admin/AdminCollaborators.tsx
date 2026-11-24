"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EmailField from "@/components/ui/fields/EmailField";
import TextField from "@/components/ui/fields/TextField";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { isValidEmail } from "@/lib/field-format";
import { formatHumanDate, STUDIO_TIME_ZONE } from "@/lib/field-format";

export type Collaborator = { email: string; name?: string; addedAt?: string };

// Second-photographer access for one project: lists collaborators (read-only
// portal access), adds one by email with an optional name and invite, and
// removes one. Posts to /api/admin/collaborators and refreshes the page.
export default function AdminCollaborators({
  projectId,
  collaborators,
}: {
  projectId: string;
  collaborators: Collaborator[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // "add" | the email being removed
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState("");

  async function post(body: Record<string, unknown>, busyKey: string, doneText: string) {
    setBusy(busyKey);
    setError(null);
    setDone("");
    try {
      const res = await fetch("/api/admin/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("request failed");
      setDone(doneText);
      router.refresh();
      return true;
    } catch {
      setError("Couldn't update. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    const ok = await post(
      {
        action: "add",
        projectId,
        email: email.trim(),
        name: name.trim() || undefined,
        sendInvite,
      },
      "add",
      "Added.",
    );
    if (ok) {
      setEmail("");
      setName("");
    }
  }

  return (
    <div>
      {collaborators.length === 0 ? (
        <p className="text-sm text-muted">
          No one else has access yet. Add a second photographer below to give
          them read-only access to this project&rsquo;s details and documents.
        </p>
      ) : (
        <ul className="space-y-2">
          {collaborators.map((c) => (
            <li
              key={c.email}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{c.name || c.email}</div>
                {c.name && (
                  <div className="truncate text-xs text-muted">
                    {c.email}
                  </div>
                )}
                {c.addedAt && (
                  <div className="text-xs text-muted">
                    Added{" "}
                    {formatHumanDate(c.addedAt, { timeZone: STUDIO_TIME_ZONE })}
                  </div>
                )}
              </div>
              <Button
                variant="text"
                className="whitespace-nowrap"
                loading={busy === c.email}
                loadingLabel="Removing…"
                onClick={() =>
                  post(
                    { action: "remove", projectId, email: c.email },
                    c.email,
                    "Removed.",
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <EmailField
          id="collab-email"
          label="Add a second photographer"
          value={email}
          onChange={setEmail}
          placeholder="them@example.com"
        />
        <TextField
          id="collab-name"
          label="Name (optional)"
          value={name}
          onChange={setName}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
          />
          Email them a one-click sign-in link
        </label>
        <Button
          variant="secondary"
          size="sm"
          onClick={add}
          disabled={!email.trim()}
          loading={busy === "add"}
          loadingLabel="Granting…"
        >
          Grant access
        </Button>
        <FormStatus state={error ? "error" : done ? "ok" : "idle"} ok={done} error={error ?? ""} className="block" />
      </div>
    </div>
  );
}
