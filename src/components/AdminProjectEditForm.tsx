"use client";

// Owner edit form for a single client record. Posts the editable scalar fields
// to /api/admin/update (admin-gated). Array fields (locations, dates,
// documents, status history) are shown read-only on the detail page; edit those
// in Supabase if needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";

type Initial = {
  projectName?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  partnerName?: string;
  status?: string;
  serviceType?: string;
  package?: string;
  eventDate?: string;
  guestCount?: number;
  budget?: string;
  planSummary?: string;
  internalNotes?: string;
  galleryUrl?: string;
};
type Status = "idle" | "saving" | "saved" | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const label = "block text-sm font-medium mb-1.5";

export default function AdminProjectEditForm({
  id,
  initial,
  namePlaceholder,
}: {
  id: string;
  initial: Initial;
  namePlaceholder?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    projectName: initial.projectName ?? "",
    clientName: initial.clientName ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
    partnerName: initial.partnerName ?? "",
    status: initial.status ?? "new-inquiry",
    serviceType: initial.serviceType ?? "",
    package: initial.package ?? "",
    eventDate: initial.eventDate ?? "",
    guestCount: initial.guestCount != null ? String(initial.guestCount) : "",
    budget: initial.budget ?? "",
    planSummary: initial.planSummary ?? "",
    internalNotes: initial.internalNotes ?? "",
    galleryUrl: initial.galleryUrl ?? "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [notifyClient, setNotifyClient] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          notifyClient,
          fields: {
            ...v,
            guestCount: v.guestCount === "" ? undefined : Number(v.guestCount),
          },
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
        <label htmlFor="a-project-name" className={label}>
          Project name{" "}
          <span className="text-[var(--muted)] font-normal">
            (leave blank for the auto name)
          </span>
        </label>
        <input
          id="a-project-name"
          value={v.projectName}
          onChange={set("projectName")}
          placeholder={namePlaceholder}
          className={input}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="a-status" className={label}>
            Status
          </label>
          <select
            id="a-status"
            value={v.status}
            onChange={set("status")}
            className={input}
          >
            {CLIENT_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="a-service" className={label}>
            Service type (slug)
          </label>
          <input id="a-service" value={v.serviceType} onChange={set("serviceType")} className={input} />
        </div>
        <div>
          <label htmlFor="a-name" className={label}>
            Client name
          </label>
          <input id="a-name" value={v.clientName} onChange={set("clientName")} className={input} />
        </div>
        <div>
          <label htmlFor="a-partner" className={label}>
            Partner name
          </label>
          <input id="a-partner" value={v.partnerName} onChange={set("partnerName")} className={input} />
        </div>
        <div>
          <label htmlFor="a-email" className={label}>
            Email
          </label>
          <input id="a-email" type="email" value={v.email} onChange={set("email")} className={input} />
        </div>
        <div>
          <label htmlFor="a-phone" className={label}>
            Phone
          </label>
          <input id="a-phone" value={v.phone} onChange={set("phone")} className={input} />
        </div>
        <div>
          <label htmlFor="a-package" className={label}>
            Package
          </label>
          <input id="a-package" value={v.package} onChange={set("package")} className={input} />
        </div>
        <div>
          <label htmlFor="a-date" className={label}>
            Event date
          </label>
          <input id="a-date" value={v.eventDate} onChange={set("eventDate")} placeholder="e.g. 2027-06-12" className={input} />
        </div>
        <div>
          <label htmlFor="a-guests" className={label}>
            Guest count
          </label>
          <input id="a-guests" type="number" min={0} value={v.guestCount} onChange={set("guestCount")} className={input} />
        </div>
        <div>
          <label htmlFor="a-budget" className={label}>
            Budget
          </label>
          <input id="a-budget" value={v.budget} onChange={set("budget")} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="a-plan" className={label}>
          Plan summary <span className="text-[var(--muted)] font-normal">(shown to the client)</span>
        </label>
        <textarea id="a-plan" rows={4} value={v.planSummary} onChange={set("planSummary")} className={input} />
      </div>
      <div>
        <label htmlFor="a-gallery" className={label}>
          Gallery URL{" "}
          <span className="text-[var(--muted)] font-normal">
            (Pic-Time link — shown to the client when set)
          </span>
        </label>
        <input
          id="a-gallery"
          type="url"
          value={v.galleryUrl}
          onChange={set("galleryUrl")}
          placeholder="https://…"
          className={input}
        />
      </div>
      <div>
        <label htmlFor="a-notes" className={label}>
          Internal notes <span className="text-[var(--muted)] font-normal">(private — never shown to the client)</span>
        </label>
        <textarea id="a-notes" rows={4} value={v.internalNotes} onChange={set("internalNotes")} className={input} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={notifyClient}
          onChange={(e) => setNotifyClient(e.target.checked)}
        />
        Email the client about this update
      </label>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-[var(--muted)]">Saved.</span>
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
