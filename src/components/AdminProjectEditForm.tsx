"use client";

// Owner edit form for a single client record. Posts the editable scalar fields
// to /api/admin/update (admin-gated). Array fields (locations, dates,
// documents, status history) are shown read-only on the detail page; edit those
// in Supabase if needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
// Imported directly (not via @/lib/content) so this client component doesn't
// pull the server-only content layer into the browser bundle.
import { services } from "@/lib/services-data";

// Coerce a stored event date into the `yyyy-MM-dd` a <input type="date"> needs.
// An ISO calendar date is returned as-is (no timezone shift); other parseable
// formats are reformatted; anything unparseable returns "" so the caller can
// fall back to a free-text field rather than silently dropping the value.
function toDateInput(s?: string): string {
  const raw = (s ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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
  clientNotes?: string;
  clientNotesReply?: string;
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
  aiEnabled = false,
}: {
  id: string;
  initial: Initial;
  namePlaceholder?: string;
  // When true, offers a "Draft with AI" button on the client-facing plan summary.
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  // A stored date that doesn't fit the native picker (legacy free text) falls
  // back to an editable text field so the value is preserved, not dropped.
  const isoEventDate = toDateInput(initial.eventDate);
  const eventDateUnparseable =
    !!(initial.eventDate ?? "").trim() && !isoEventDate;
  const [v, setV] = useState({
    projectName: initial.projectName ?? "",
    clientName: initial.clientName ?? "",
    email: initial.email ?? "",
    phone: initial.phone ?? "",
    partnerName: initial.partnerName ?? "",
    status: initial.status ?? "new-inquiry",
    serviceType: initial.serviceType ?? "",
    package: initial.package ?? "",
    eventDate: eventDateUnparseable
      ? (initial.eventDate ?? "").trim()
      : isoEventDate,
    guestCount: initial.guestCount != null ? String(initial.guestCount) : "",
    budget: initial.budget ?? "",
    planSummary: initial.planSummary ?? "",
    clientNotesReply: initial.clientNotesReply ?? "",
    internalNotes: initial.internalNotes ?? "",
    galleryUrl: initial.galleryUrl ?? "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [notifyClient, setNotifyClient] = useState(false);
  const [planStatus, setPlanStatus] = useState<
    "idle" | "drafting" | "drafted" | "error"
  >("idle");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  // Draft the client-facing plan summary with AI, into the editable field.
  async function draftPlan() {
    if (
      v.planSummary.trim() &&
      !window.confirm("Replace the current plan summary with an AI draft?")
    ) {
      return;
    }
    setPlanStatus("drafting");
    try {
      const res = await fetch("/api/admin/draft-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted && typeof data.summary === "string") {
        setV((prev) => ({ ...prev, planSummary: data.summary }));
        setPlanStatus("drafted");
      } else {
        setPlanStatus("idle");
      }
    } catch {
      setPlanStatus("error");
    }
  }

  // Changing the service clears a package that doesn't belong to the new
  // service, so the package selection can never contradict the service.
  function setService(e: React.ChangeEvent<HTMLSelectElement>) {
    const serviceType = e.target.value;
    setV((prev) => {
      const svc = services.find((s) => s.slug === serviceType);
      const keepPackage = !!svc?.packages.some((p) => p.name === prev.package);
      return { ...prev, serviceType, package: keepPackage ? prev.package : "" };
    });
  }

  // Packages offered by the currently-selected service drive the package list.
  const currentService = services.find((s) => s.slug === v.serviceType);
  const packageOptions = currentService?.packages ?? [];

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
            Service
          </label>
          <select
            id="a-service"
            value={v.serviceType}
            onChange={setService}
            className={input}
          >
            <option value="">— Select a service —</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
            {/* Preserve an existing slug that isn't in the current catalog. */}
            {v.serviceType &&
              !services.some((s) => s.slug === v.serviceType) && (
                <option value={v.serviceType}>{v.serviceType}</option>
              )}
          </select>
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
          <input id="a-phone" type="tel" value={v.phone} onChange={set("phone")} className={input} />
        </div>
        <div>
          <label htmlFor="a-package" className={label}>
            Package
          </label>
          <select
            id="a-package"
            value={v.package}
            onChange={set("package")}
            disabled={!v.serviceType}
            className={`${input} disabled:opacity-50`}
          >
            <option value="">
              {v.serviceType ? "— Select a package —" : "Choose a service first"}
            </option>
            {packageOptions.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {p.price}
              </option>
            ))}
            {/* Preserve an existing package that isn't in the service's list. */}
            {v.package &&
              !packageOptions.some((p) => p.name === v.package) && (
                <option value={v.package}>{v.package}</option>
              )}
          </select>
        </div>
        <div>
          <label htmlFor="a-date" className={label}>
            Event date
          </label>
          {eventDateUnparseable ? (
            <>
              <input
                id="a-date"
                value={v.eventDate}
                onChange={set("eventDate")}
                placeholder="YYYY-MM-DD"
                className={input}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Re-enter as YYYY-MM-DD to use the date picker.
              </p>
            </>
          ) : (
            <input
              id="a-date"
              type="date"
              value={v.eventDate}
              onChange={set("eventDate")}
              className={input}
            />
          )}
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
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="a-plan" className="text-sm font-medium">
            Plan summary{" "}
            <span className="text-[var(--muted)] font-normal">
              (shown to the client)
            </span>
          </label>
          {aiEnabled && (
            <button
              type="button"
              onClick={draftPlan}
              disabled={planStatus === "drafting"}
              className="text-xs rounded-full border border-[var(--foreground)] px-3 py-1 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
            >
              {planStatus === "drafting" ? "Drafting…" : "✨ Draft with AI"}
            </button>
          )}
        </div>
        <textarea id="a-plan" rows={4} value={v.planSummary} onChange={set("planSummary")} className={input} />
        {planStatus === "drafted" && (
          <p className="mt-1 text-xs text-[var(--accent)]">
            AI draft — review and edit before saving.
          </p>
        )}
        {planStatus === "error" && (
          <p className="mt-1 text-xs text-red-700">
            Couldn&rsquo;t draft — please try again.
          </p>
        )}
      </div>
      {(initial.clientNotes || initial.clientNotesReply) && (
        <div>
          <label htmlFor="a-reply" className={label}>
            Client notes &amp; questions{" "}
            <span className="text-[var(--muted)] font-normal">
              (from the client — your reply is shown to them)
            </span>
          </label>
          {initial.clientNotes ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm whitespace-pre-line">
              {initial.clientNotes}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No notes from the client yet.
            </p>
          )}
          <textarea
            id="a-reply"
            rows={3}
            value={v.clientNotesReply}
            onChange={set("clientNotesReply")}
            placeholder="Reply to the client…"
            className={`${input} mt-3`}
          />
        </div>
      )}
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
