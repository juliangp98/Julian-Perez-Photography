"use client";

// "Create a project" panel. On /admin/projects the owner enters the client's
// contact details; on the portal dashboard the email comes from the session.
// Warns (but allows) on a duplicate and lands on the new project on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { services, serviceTitle } from "@/lib/services-data";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import PhoneField from "@/components/ui/fields/PhoneField";
import DateField from "@/components/ui/fields/DateField";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import Panel from "@/components/ui/Panel";

type Dup = { id: string; clientName?: string; serviceType?: string };
type Audience = "admin" | "portal";

const CONFIG = {
  admin: {
    endpoint: "/api/admin/create-project",
    projectPath: "/admin/projects",
    idPrefix: "np",
    openLabel: "+ New project",
    // Beside the closed button.
    openHint: "Booked through Square, or over the phone? Add the project here.",
    heading: "New project",
    intro: null,
    serviceLabel: "Service",
    dateLabel: "Event date",
    dupLead: "A",
    dupTail: "project already exists for this email.",
    forceLabel: "Create another anyway",
  },
  portal: {
    endpoint: "/api/portal/create-project",
    projectPath: "/portal/projects",
    idPrefix: "pnp",
    openLabel: "+ Start a new project",
    openHint: null,
    heading: "Start a new project",
    intro: (
      <p className="text-sm text-muted">
        Pick what you have in mind and I&rsquo;ll set up a project you can fill
        in. I&rsquo;ll use the email you signed in with.
      </p>
    ),
    serviceLabel: "What are you thinking?",
    dateLabel: "Date (if you have one)",
    dupLead: "You already have a",
    dupTail: "project.",
    forceLabel: "Start another anyway",
  },
} satisfies Record<Audience, unknown>;

export default function NewProjectForm({ audience = "admin" }: { audience?: Audience }) {
  const c = CONFIG[audience];
  const withContact = audience === "admin";
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
    if (withContact && !v.email.trim()) return;
    setStatus("saving");
    setDup(null);
    try {
      const res = await fetch(c.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withContact
            ? {
                email: v.email.trim(),
                clientName: v.clientName.trim() || undefined,
                phone: v.phone.trim() || undefined,
                serviceType: v.serviceType || undefined,
                eventDate: v.eventDate || undefined,
                force,
              }
            : {
                serviceType: v.serviceType || undefined,
                eventDate: v.eventDate || undefined,
                force,
              },
        ),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.duplicate) {
        setDup(data.duplicate);
        setStatus("idle");
        return;
      }
      if (data.id) {
        router.push(`${c.projectPath}/${data.id}`);
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={() => setOpen(true)}>{c.openLabel}</Button>
        {c.openHint && <p className="text-sm text-muted">{c.openHint}</p>}
      </div>
    );
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">{c.heading}</h2>
        <Button variant="text" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create(false);
        }}
        className="mt-4 space-y-4"
      >
        {c.intro}
        <div className="grid sm:grid-cols-2 gap-4">
          {withContact && (
            <>
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
            </>
          )}
          <SelectField
            id={`${c.idPrefix}-service`}
            label={c.serviceLabel}
            value={v.serviceType}
            onChange={setStr("serviceType")}
            placeholder="Not sure yet"
            clearable
            options={services.map((s) => ({ value: s.slug, label: s.title }))}
          />
          <DateField
            id={`${c.idPrefix}-date`}
            label={c.dateLabel}
            value={v.eventDate}
            onChange={setStr("eventDate")}
          />
        </div>

        {dup && (
          <div className="rounded-lg border border-accent/40 bg-accent/[0.05] p-3 text-sm">
            {c.dupLead}{" "}
            {dup.serviceType ? `${serviceTitle(dup.serviceType)} ` : ""}
            {c.dupTail}
            <div className="mt-2 flex flex-wrap gap-4">
              <Link
                href={`${c.projectPath}/${dup.id}`}
                className="underline underline-offset-2 hover:text-accent"
              >
                Open it
              </Link>
              <button
                type="button"
                onClick={() => create(true)}
                className="underline underline-offset-2 hover:text-accent"
              >
                {c.forceLabel}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={withContact && !v.email.trim()}
            loading={status === "saving"}
            loadingLabel="Creating…"
          >
            Create project
          </Button>
          <FormStatus state={status} error="Couldn't create. Try again." />
        </div>
      </form>
    </Panel>
  );
}
