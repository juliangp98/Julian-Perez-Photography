"use client";

// Admin-side "create a project" — an inline panel on /admin/projects. Creates a
// stub from whatever Julian has; warns (but allows) on an email+service
// duplicate; lands on the new project's page on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { services, serviceTitle } from "@/lib/services-data";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import PhoneField from "@/components/ui/fields/PhoneField";
import DateField from "@/components/ui/fields/DateField";
import { submitButtonClass } from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";

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

  const setStr =
    (k: keyof typeof v) =>
    (val: string) =>
      setV((p) => ({ ...p, [k]: val }));

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
      <button type="button" onClick={() => setOpen(true)} className={submitButtonClass}>
        + New project
      </button>
    );
  }

  return (
    <Panel>
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
          <TextField
            id="np-name"
            label="Client name"
            value={v.clientName}
            onChange={setStr("clientName")}
            autoComplete="name"
          />
          <EmailField
            id="np-email"
            label="Email"
            required
            value={v.email}
            onChange={setStr("email")}
          />
          <PhoneField id="np-phone" value={v.phone} onChange={setStr("phone")} />
          <SelectField
            id="np-service"
            label="Service"
            value={v.serviceType}
            onChange={setStr("serviceType")}
            placeholder="Not sure yet"
            clearable
            options={services.map((s) => ({ value: s.slug, label: s.title }))}
          />
          <DateField
            id="np-date"
            label="Event date"
            value={v.eventDate}
            onChange={setStr("eventDate")}
          />
        </div>

        {dup && (
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3 text-sm">
            A{" "}
            {dup.serviceType ? `${serviceTitle(dup.serviceType)} ` : ""}
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
