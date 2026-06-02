"use client";

// Limited client-portal edits. Posts a whitelist of fields to
// /api/portal/update (the server enforces the same whitelist + session). On
// success, refreshes the server component so the new values render.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  phone?: string;
  partnerName?: string;
  guestCount?: number;
  planSummary?: string;
};
type Status = "idle" | "saving" | "saved" | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const label = "block text-sm font-medium mb-1.5";

export default function PortalEditForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [partnerName, setPartnerName] = useState(initial.partnerName ?? "");
  const [guestCount, setGuestCount] = useState(
    initial.guestCount != null ? String(initial.guestCount) : "",
  );
  const [planSummary, setPlanSummary] = useState(initial.planSummary ?? "");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/portal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          partnerName,
          guestCount: guestCount === "" ? undefined : Number(guestCount),
          planSummary,
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
        <label htmlFor="pf-plan" className={label}>
          Notes / questions for me
        </label>
        <textarea
          id="pf-plan"
          rows={4}
          value={planSummary}
          onChange={(e) => setPlanSummary(e.target.value)}
          className={input}
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
