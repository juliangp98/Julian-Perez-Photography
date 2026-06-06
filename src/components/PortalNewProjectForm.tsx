"use client";

// Client-side "start a new project" — an inline panel on the portal dashboard
// for a signed-in (returning) client. The email comes from the session, so they
// only pick a service (or "Not sure yet") + an optional date. Warns (but allows)
// on a duplicate; lands on the new project on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { services } from "@/lib/services-data";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const label = "block text-sm font-medium mb-1.5";
const primary =
  "px-5 py-2.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition disabled:opacity-50";

type Dup = { id: string; serviceType?: string };

export default function PortalNewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [dup, setDup] = useState<Dup | null>(null);

  async function create(force: boolean) {
    setStatus("saving");
    setDup(null);
    try {
      const res = await fetch("/api/portal/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: serviceType || undefined,
          eventDate: eventDate || undefined,
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
        router.push(`/portal/projects/${data.id}`);
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
        + Start a new project
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">Start a new project</h2>
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
        <p className="text-sm text-[var(--muted)]">
          Pick what you have in mind and I&rsquo;ll set up a project you can fill
          in. I&rsquo;ll use the email you signed in with.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pnp-service" className={label}>
              What are you thinking?
            </label>
            <select
              id="pnp-service"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
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
            <label htmlFor="pnp-date" className={label}>
              Date (if you have one)
            </label>
            <input
              id="pnp-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={input}
            />
          </div>
        </div>

        {dup && (
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3 text-sm">
            You already have a{" "}
            {dup.serviceType ? `${dup.serviceType.replace(/-/g, " ")} ` : ""}
            project.
            <div className="mt-2 flex flex-wrap gap-4">
              <Link
                href={`/portal/projects/${dup.id}`}
                className="underline underline-offset-2 hover:text-[var(--accent)]"
              >
                Open it
              </Link>
              <button
                type="button"
                onClick={() => create(true)}
                className="underline underline-offset-2 hover:text-[var(--accent)]"
              >
                Start another anyway
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={status === "saving"}
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
