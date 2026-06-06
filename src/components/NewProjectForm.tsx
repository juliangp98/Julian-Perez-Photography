"use client";

// Admin-side "create a project" — an inline panel on /admin/projects. Creates a
// stub from whatever Julian has; warns (but allows) on an email+service
// duplicate; lands on the new project's page on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { services } from "@/lib/services-data";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const label = "block text-sm font-medium mb-1.5";
const primary =
  "px-5 py-2.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-50";

type Dup = { id: string; clientName?: string; serviceType?: string };

export default function NewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    clientName: "",
    email: "",
    phone: "",
    serviceType: "",
    eventDate: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [dup, setDup] = useState<Dup | null>(null);

  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  async function create(force: boolean) {
    if (!v.email.trim()) return;
    setStatus("saving");
    setDup(null);
    try {
      const res = await fetch("/api/admin/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: v.email.trim(),
          clientName: v.clientName.trim() || undefined,
          phone: v.phone.trim() || undefined,
          serviceType: v.serviceType || undefined,
          eventDate: v.eventDate || undefined,
          force,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.duplicate) {
        setDup(data.duplicate);
        setStatus("idle");
        return;
      }
      if (data.id) {
        router.push(`/admin/projects/${data.id}`);
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primary}>
        + New project
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">New project</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Cancel
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create(false);
        }}
        className="mt-4 space-y-4"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="np-name" className={label}>
              Client name
            </label>
            <input
              id="np-name"
              value={v.clientName}
              onChange={set("clientName")}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="np-email" className={label}>
              Email <span className="text-[var(--accent)]">*</span>
            </label>
            <input
              id="np-email"
              type="email"
              required
              value={v.email}
              onChange={set("email")}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="np-phone" className={label}>
              Phone
            </label>
            <input
              id="np-phone"
              type="tel"
              value={v.phone}
              onChange={set("phone")}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="np-service" className={label}>
              Service
            </label>
            <select
              id="np-service"
              value={v.serviceType}
              onChange={set("serviceType")}
              className={input}
            >
              <option value="">Not sure yet</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="np-date" className={label}>
              Event date
            </label>
            <input
              id="np-date"
              type="date"
              value={v.eventDate}
              onChange={set("eventDate")}
              className={input}
            />
          </div>
        </div>

        {dup && (
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3 text-sm">
            A{" "}
            {dup.serviceType ? `${dup.serviceType.replace(/-/g, " ")} ` : ""}
            project already exists for this email.
            <div className="mt-2 flex flex-wrap gap-4">
              <Link
                href={`/admin/projects/${dup.id}`}
                className="underline underline-offset-2 hover:text-[var(--accent)]"
              >
                Open it
              </Link>
              <button
                type="button"
                onClick={() => create(true)}
                className="underline underline-offset-2 hover:text-[var(--accent)]"
              >
                Create another anyway
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={status === "saving" || !v.email.trim()}
            className={primary}
          >
            {status === "saving" ? "Creating…" : "Create project"}
          </button>
          {status === "error" && (
            <span role="alert" className="text-sm text-red-700">
              Couldn&rsquo;t create — please try again.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
