import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { getProjectForEmail } from "@/lib/clients";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import { getQuestionnaire } from "@/lib/questionnaires";
import PortalEditForm from "@/components/PortalEditForm";
import PortalDocumentUpload from "@/components/PortalDocumentUpload";

// One project view. Renders ONLY the client-safe projection and is gated to the
// signed-in person's email (getProjectForEmail), so a client can never open a
// project id that isn't theirs.
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};

function questionnaireLinkFor(record: {
  serviceType?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  partnerName?: string;
  eventDate?: string;
  guestCount?: number;
}): { href: string } | null {
  if (!record.serviceType) return null;
  const q = getQuestionnaire(record.serviceType);
  if (!q) return null;
  const params = new URLSearchParams();
  if (record.clientName) params.set("fullName", record.clientName);
  if (record.email) params.set("email", record.email);
  if (record.phone) params.set("phone", record.phone);
  if (record.partnerName) params.set("partnerFullName", record.partnerName);
  if (record.eventDate) params.set("eventDate", record.eventDate);
  if (record.guestCount != null) params.set("guestCount", String(record.guestCount));
  return { href: `/questionnaire/${record.serviceType}?${params.toString()}` };
}

function formatDate(d?: string): string | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-12">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/portal");
  const { id } = await params;
  const record = await getProjectForEmail(id, session.email);
  if (!record) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-24">
        <Link
          href="/portal/dashboard"
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Your projects
        </Link>
        <h1 className="mt-4 font-serif text-3xl">Project not found</h1>
        <p className="mt-3 text-[var(--muted)]">
          That project isn&rsquo;t on your account. Head back to your projects.
        </p>
      </section>
    );
  }

  const link = questionnaireLinkFor(record);

  return (
    <section className="max-w-3xl mx-auto px-6 py-20">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/portal/dashboard"
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Your projects
        </Link>
        <form action="/portal/logout" method="post">
          <button
            type="submit"
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer bg-transparent border-0 p-0"
          >
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-4 font-serif text-4xl">
        {record.serviceType
          ? record.serviceType.replace(/-/g, " ")
          : record.clientName || "Your project"}
      </h1>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs uppercase tracking-[0.18em]">
          {CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ??
            "In progress"}
        </span>
        {record.bundleLabel && (
          <span className="inline-block px-3 py-1 rounded-full border border-[var(--accent)] text-[var(--accent)] text-xs uppercase tracking-[0.18em]">
            ↔ {record.bundleLabel}
          </span>
        )}
      </div>

      {link && (
        <div className="mt-8 p-5 border border-[var(--accent)] rounded-lg bg-white">
          <p className="text-sm font-medium">Add your event details</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Fill out your planning questionnaire so I show up fully prepared —
            your details here are carried over, and anything you add flows
            straight back to this project.
          </p>
          <a
            href={link.href}
            className="mt-3 inline-block px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full text-sm hover:opacity-90 transition"
          >
            Open your {record.serviceType?.replace(/-/g, " ")} questionnaire →
          </a>
        </div>
      )}

      <div className="mt-10 grid sm:grid-cols-2 gap-6">
        {record.package && <Detail label="Package" value={record.package} />}
        {formatDate(record.eventDate) && (
          <Detail label="Event date" value={formatDate(record.eventDate)!} />
        )}
        {record.guestCount != null && (
          <Detail label="Guest count" value={String(record.guestCount)} />
        )}
        {record.partnerName && (
          <Detail label="Partner" value={record.partnerName} />
        )}
      </div>

      {record.secondaryDates && record.secondaryDates.length > 0 && (
        <Section title="Other dates">
          <ul className="border-t border-[var(--border)]">
            {record.secondaryDates.map((d, i) => (
              <li
                key={i}
                className="flex justify-between py-3 border-b border-[var(--border)] gap-4"
              >
                <span>{d.label ?? "Date"}</span>
                <span className="text-[var(--muted)]">{formatDate(d.date)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {record.locations && record.locations.length > 0 && (
        <Section title="Locations">
          <div className="space-y-4">
            {record.locations.map((l, i) => (
              <div key={i} className="p-4 border border-[var(--border)] rounded-lg">
                {l.label && <div className="font-medium">{l.label}</div>}
                {l.address && (
                  <div className="mt-1 text-sm text-[var(--muted)] whitespace-pre-line">
                    {l.address}
                  </div>
                )}
                {l.notes && (
                  <div className="mt-1 text-sm text-[var(--muted)]">{l.notes}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {record.planSummary && (
        <Section title="Plan">
          <p className="whitespace-pre-line leading-relaxed text-[var(--foreground)]/90">
            {record.planSummary}
          </p>
        </Section>
      )}

      {record.documents && record.documents.length > 0 && (
        <Section title="Documents">
          <ul className="border-t border-[var(--border)]">
            {record.documents.map((doc, i) => (
              <li key={i} className="border-b border-[var(--border)]">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex justify-between items-baseline py-3 gap-4 hover:text-[var(--accent)] transition"
                >
                  <span>{doc.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] whitespace-nowrap">
                    {doc.type ?? "file"} &#8599;
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Update your details">
        <p className="text-sm text-[var(--muted)] mb-5">
          Keep your contact info and notes current — I&rsquo;ll see any changes
          you make here.
        </p>
        <PortalEditForm
          projectId={record.id}
          initial={{
            phone: record.phone,
            partnerName: record.partnerName,
            guestCount: record.guestCount,
            planSummary: record.planSummary,
          }}
        />
      </Section>

      <Section title="Upload a document">
        <p className="text-sm text-[var(--muted)] mb-4">
          Share anything useful — a venue floor plan, a timeline, an inspiration
          PDF. I&rsquo;ll see it attached to this project.
        </p>
        <PortalDocumentUpload projectId={record.id} />
      </Section>
    </section>
  );
}
