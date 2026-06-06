"use client";

// Limited client-portal edits. Posts a whitelist of fields to
// /api/portal/update (the server enforces the same whitelist + session). On
// success, refreshes the server component so the new values render.

import { useState } from "react";
import { useRouter } from "next/navigation";
import AssistedTextarea, {
  type AssistContext,
} from "@/components/AssistedTextarea";

type Initial = {
  phone?: string;
  partnerName?: string;
  guestCount?: number;
  clientNotes?: string;
  clientNotesReply?: string;
  projectName?: string;
};
type Status = "idle" | "saving" | "saved" | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const label = "block text-sm font-medium mb-1.5";

export default function PortalEditForm({
  projectId,
  initial,
  namePlaceholder,
  aiEnabled = false,
  projectContext,
}: {
  projectId: string;
  initial: Initial;
  namePlaceholder?: string;
  aiEnabled?: boolean;
  // Read-only project facts (from the server) used to ground the notes assist.
  projectContext?: {
    clientName?: string;
    service?: string;
    eventDate?: string;
    status?: string;
  };
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [partnerName, setPartnerName] = useState(initial.partnerName ?? "");
  const [guestCount, setGuestCount] = useState(
    initial.guestCount != null ? String(initial.guestCount) : "",
  );
  const [clientNotes, setClientNotes] = useState(initial.clientNotes ?? "");
  const [projectName, setProjectName] = useState(initial.projectName ?? "");
  const [status, setStatus] = useState<Status>("idle");

  // Ground the notes assist in the project's known facts + the client's live
  // edits, so a drafted question reads as theirs ("our June wedding at …").
  function assistContext(): AssistContext {
    const details: { label: string; value: string }[] = [];
    const add = (label: string, value?: string | null) => {
      const v = (value ?? "").trim();
      if (v) details.push({ label, value: v });
    };
    add("Event date", projectContext?.eventDate);
    add("Project status", projectContext?.status);
    add("Project name", projectName);
    add("Partner name", partnerName);
    add("Guest count", guestCount);
    return { clientName: projectContext?.clientName, details };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/portal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          phone,
          partnerName,
          guestCount: guestCount === "" ? undefined : Number(guestCount),
          clientNotes,
          projectName,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="pf-name" className={label}>
          Project name{" "}
          <span className="text-[var(--muted)] font-normal">
            (leave blank for the default)
          </span>
        </label>
        <input
          id="pf-name"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={namePlaceholder}
          className={input}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="pf-phone" className={label}>
            Phone
          </label>
          <input
            id="pf-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="pf-partner" className={label}>
            Partner name
          </label>
          <input
            id="pf-partner"
            type="text"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="pf-guests" className={label}>
            Guest count
          </label>
          <input
            id="pf-guests"
            type="number"
            min={0}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            className={input}
          />
        </div>
      </div>
      <div>
        <label htmlFor="pf-notes" className={label}>
          Notes / questions for me
        </label>
        <p className="text-xs text-[var(--muted)] mt-0.5 mb-2">
          Anything you&rsquo;d like me to know, or questions you have — I&rsquo;ll
          see these and reply here.
        </p>
        {initial.clientNotesReply && (
          <div className="mb-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Julian&rsquo;s reply
            </div>
            <p className="mt-1 text-sm whitespace-pre-line">
              {initial.clientNotesReply}
            </p>
          </div>
        )}
        <AssistedTextarea
          id="pf-notes"
          rows={4}
          value={clientNotes}
          onChange={setClientNotes}
          textareaClassName={input}
          assist={{
            kind: "portal-note",
            question: "Notes or questions for your photographer",
            service: projectContext?.service,
            enabled: aiEnabled,
            getContext: assistContext,
          }}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-[var(--muted)]">Saved — thank you!</span>
        )}
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t save — please try again.
          </span>
        )}
      </div>
    </form>
  );
}
