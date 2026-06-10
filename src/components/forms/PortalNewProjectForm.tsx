"use client";

// Client-side "start a new project" — an inline panel on the portal dashboard
// for a signed-in (returning) client. The email comes from the session, so they
// only pick a service (or "Not sure yet") + an optional date. Warns (but allows)
// on a duplicate; lands on the new project on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { services, serviceTitle } from "@/lib/services-data";
import DateField from "@/components/ui/fields/DateField";
import SelectField from "@/components/ui/fields/SelectField";
import { submitButtonClass } from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";

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
      <button type="button" onClick={() => setOpen(true)} className={submitButtonClass}>
        + Start a new project
      </button>
    );
  }

  return (
    <Panel>
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
          <SelectField
            id="pnp-service"
            label="What are you thinking?"
            value={serviceType}
            onChange={setServiceType}
            placeholder="Not sure yet"
            clearable
            options={services.map((s) => ({ value: s.slug, label: s.title }))}
          />
          <DateField
            id="pnp-date"
            label="Date (if you have one)"
            value={eventDate}
            onChange={setEventDate}
          />
        </div>

        {dup && (
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3 text-sm">
            You already have a{" "}
            {dup.serviceType ? `${serviceTitle(dup.serviceType)} ` : ""}
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
            className={submitButtonClass}
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
    </Panel>
  );
}
