import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { getClientById } from "@/lib/clients";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import PortalEditForm from "@/components/PortalEditForm";
import PortalDocumentUpload from "@/components/PortalDocumentUpload";

// Authenticated portal home. Renders ONLY the client-safe projection
// (`SAFE_SELECT` in src/lib/clients.ts) — internal notes and admin columns are
// excluded at the query layer and never reach this component. Gated by
// middleware.ts; the getSession() check is defense-in-depth and supplies the
// record id from the verified session cookie (never from the URL).
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};

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

export default async function PortalDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/portal");
  const record = await getClientById(session.recordId);

  return (
    <section className="max-w-3xl mx-auto px-6 py-20">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Your project
        </div>
        <Link
          href="/portal/logout"
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Sign out
        </Link>
      </div>

      {!record ? (
        <div className="mt-8 p-8 border border-dashed border-[var(--border)] rounded-lg">
          <h1 className="font-serif text-3xl">Signed in</h1>
          <p className="mt-3 text-[var(--muted)]">
            I couldn&rsquo;t load your project details right now. Please email me
            and I&rsquo;ll get it sorted.
          </p>
        </div>
      ) : (
        <>
          <h1 className="mt-2 font-serif text-4xl">
            {record.clientName ?? "Your project"}
          </h1>
          <div className="mt-3">
            <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs uppercase tracking-[0.18em]">
              {CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] ??
                "In progress"}
            </span>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 gap-6">
            {record.serviceType && (
              <Detail label="Service" value={record.serviceType} />
            )}
            {record.package && (
              <Detail label="Package" value={record.package} />
            )}
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
                    <span className="text-[var(--muted)]">
                      {formatDate(d.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {record.locations && record.locations.length > 0 && (
            <Section title="Locations">
              <div className="space-y-4">
                {record.locations.map((l, i) => (
                  <div
                    key={i}
                    className="p-4 border border-[var(--border)] rounded-lg"
                  >
                    {l.label && <div className="font-medium">{l.label}</div>}
                    {l.address && (
                      <div className="mt-1 text-sm text-[var(--muted)] whitespace-pre-line">
                        {l.address}
                      </div>
                    )}
                    {l.notes && (
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {l.notes}
                      </div>
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
              Keep your contact info and notes current — I&rsquo;ll see any
              changes you make here.
            </p>
            <PortalEditForm
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
              Share anything useful — a venue floor plan, a timeline, an
              inspiration PDF. I&rsquo;ll see it attached to your project.
            </p>
            <PortalDocumentUpload />
          </Section>

          <p className="mt-16 text-sm text-[var(--muted)]">
            Something look off you can&rsquo;t change here? Just reply to any of
            my emails and I&rsquo;ll update it.
          </p>
        </>
      )}
    </section>
  );
}
