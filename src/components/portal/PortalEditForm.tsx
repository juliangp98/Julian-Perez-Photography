"use client";

// Limited client-portal edits. Posts a whitelist of fields to
// /api/portal/update (the server enforces the same whitelist + session). On
// success, refreshes the server component so the new values render.

import { useState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/fields/TextField";
import PhoneField from "@/components/ui/fields/PhoneField";
import NumberField from "@/components/ui/fields/NumberField";
import { formatPhone } from "@/lib/field-format";

type Initial = {
  phone?: string;
  partnerName?: string;
  guestCount?: number;
  projectName?: string;
};
type Status = "idle" | "saving" | "saved" | "error";

export default function PortalEditForm({
  projectId,
  initial,
  namePlaceholder,
}: {
  projectId: string;
  initial: Initial;
  namePlaceholder?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(() => formatPhone(initial.phone ?? ""));
  const [partnerName, setPartnerName] = useState(initial.partnerName ?? "");
  const [guestCount, setGuestCount] = useState(
    initial.guestCount != null ? String(initial.guestCount) : "",
  );
  const [projectName, setProjectName] = useState(initial.projectName ?? "");
  const [status, setStatus] = useState<Status>("idle");

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
      <TextField
        id="pf-name"
        label={
          <>
            Project name{" "}
            <span className="font-normal text-[var(--muted)]">
              (leave blank for the default)
            </span>
          </>
        }
        value={projectName}
        onChange={setProjectName}
        placeholder={namePlaceholder}
      />
      <div className="grid sm:grid-cols-2 gap-5">
        <PhoneField id="pf-phone" value={phone} onChange={setPhone} />
        <TextField
          id="pf-partner"
          label="Partner name"
          value={partnerName}
          onChange={setPartnerName}
          autoComplete="name"
        />
        <NumberField
          id="pf-guests"
          label="Guest count"
          value={guestCount}
          onChange={setGuestCount}
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
