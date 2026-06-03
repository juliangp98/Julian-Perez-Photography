import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, listClientProjectsByEmailFull } from "@/lib/clients";
import AdminNav from "@/components/AdminNav";
import AdminProjectEditForm from "@/components/AdminProjectEditForm";
import PortalBundles from "@/components/PortalBundles";
import ComposeEmail from "@/components/ComposeEmail";
import { aiEnabled } from "@/lib/ai";
import {
  projectDisplayName,
  autoProjectName,
  serviceNoun,
} from "@/lib/project-name";

export const metadata: Metadata = {
  title: "Project — Admin",
  robots: { index: false, follow: false },
};

// "June 7, 2026" from an event-date string; leaves the raw value if unparseable,
// undefined if absent — used to prefill email templates.
function formatLongDate(d?: string): string | undefined {
  if (!d) return undefined;
  let date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Read({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-line text-sm">{value}</div>
    </div>
  );
}

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");
  const { id } = await params;
  const record = await getClientFull(id);
  // Siblings (same person) — offered as bundle-link choices.
  const siblings = record?.email
    ? await listClientProjectsByEmailFull(record.email)
    : [];

  // Absolute origin for links inside prefilled emails (the client opens them
  // outside the app), and the fill context for the compose templates.
  const h = await headers();
  const host = h.get("host");
  const origin = host
    ? `${h.get("x-forwarded-proto") ?? "https"}://${host}`
    : "";
  const emailContext: Record<string, string | undefined> = record
    ? {
        firstName: record.clientName?.trim().split(/\s+/)[0],
        clientName: record.clientName,
        projectName: projectDisplayName(record),
        serviceNoun: serviceNoun(record.serviceType)?.toLowerCase(),
        eventDate: formatLongDate(record.eventDate),
        venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
        galleryUrl: record.galleryUrl,
        portalUrl: `${origin}/portal`,
        bookingUrl: `${origin}/book`,
        questionnaireUrl: record.serviceType
          ? `${origin}/questionnaire/${record.serviceType}`
          : undefined,
      }
    : {};

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
      <AdminNav active="projects" />
      <Link
        href="/admin/projects"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← All projects
      </Link>

      {!record ? (
        <div className="mt-8 p-8 border border-dashed border-[var(--border)] rounded-lg text-[var(--muted)]">
          That project couldn&rsquo;t be found.
        </div>
      ) : (
        <>
          <h1 className="mt-4 font-serif text-4xl">
            {projectDisplayName(record)}
          </h1>
          {(record.clientName || record.email) && (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[record.clientName, record.email].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="mt-10">
            <AdminProjectEditForm
              id={record.id}
              namePlaceholder={autoProjectName(record)}
              initial={{
                projectName: record.projectName,
                clientName: record.clientName,
                email: record.email,
                phone: record.phone,
                partnerName: record.partnerName,
                status: record.status,
                serviceType: record.serviceType,
                package: record.package,
                eventDate: record.eventDate,
                guestCount: record.guestCount,
                budget: record.budget,
                planSummary: record.planSummary,
                internalNotes: record.internalNotes,
                galleryUrl: record.galleryUrl,
              }}
            />
          </div>

          {/* Compose a pipeline email — pick a stage template, it prefills from
              this project, edit, then send (branded) or copy. */}
          <div className="mt-14 pt-8 border-t border-[var(--border)]">
            <h2 className="font-serif text-2xl">Compose email</h2>
            <p className="mt-2 mb-4 text-sm text-[var(--muted)]">
              Pick a template for where this client is in the pipeline — it
              prefills from the project. Edit, then send or copy.
            </p>
            <ComposeEmail
              projectId={record.id}
              hasEmail={!!record.email}
              context={emailContext}
              aiEnabled={aiEnabled()}
            />
          </div>

          {/* Bundle linking — this person's projects. */}
          {siblings.length >= 2 && (
            <div className="mt-14 pt-8 border-t border-[var(--border)]">
              <h2 className="font-serif text-2xl">Bundle</h2>
              <p className="mt-2 mb-4 text-sm text-[var(--muted)]">
                Link this client&rsquo;s related projects (e.g. wedding +
                engagement) so they show grouped in their portal and here.
              </p>
              <PortalBundles
                endpoint="/api/admin/bundle"
                projects={siblings.map((s) => ({
                  id: s.id,
                  title: projectDisplayName(s),
                  bundleLabel: s.bundleLabel,
                }))}
              />
            </div>
          )}

          {/* Read-only context (edit complex / array fields in Supabase). */}
          <div className="mt-14 pt-8 border-t border-[var(--border)]">
            <h2 className="font-serif text-2xl">Details</h2>
            <div className="mt-4 divide-y divide-[var(--border)]">
              <Read label="Source" value={record.source} />
              <Read label="Referral" value={record.referral} />
              <Read label="Original inquiry" value={record.inquiryMessage} />
              {record.locations && record.locations.length > 0 && (
                <Read
                  label="Locations"
                  value={record.locations
                    .map((l) =>
                      [l.label, l.address, l.notes].filter(Boolean).join(" — "),
                    )
                    .join("\n")}
                />
              )}
              {record.secondaryDates && record.secondaryDates.length > 0 && (
                <Read
                  label="Other dates"
                  value={record.secondaryDates
                    .map((d) => [d.label, d.date].filter(Boolean).join(": "))
                    .join("\n")}
                />
              )}
              {record.documents && record.documents.length > 0 && (
                <div className="py-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Documents
                  </div>
                  <ul className="mt-1 space-y-1">
                    {record.documents.map((d, i) => (
                      <li key={i} className="text-sm">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 hover:text-[var(--accent)]"
                        >
                          {d.label}
                        </a>{" "}
                        <span className="text-xs text-[var(--muted)]">
                          ({d.type}, {d.uploadedBy})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {record.statusHistory && record.statusHistory.length > 0 && (
                <Read
                  label="Status history"
                  value={record.statusHistory
                    .map(
                      (h) =>
                        `${h.status}${h.note ? ` — ${h.note}` : ""}${
                          h.changedAt
                            ? ` (${new Date(h.changedAt).toLocaleDateString()})`
                            : ""
                        }`,
                    )
                    .join("\n")}
                />
              )}
              <Read label="Created" value={record.createdAt} />
              <Read label="Last updated" value={record.updatedAt} />
            </div>
            {record.questionnaireSnapshot && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium">
                  Questionnaire snapshot (raw)
                </summary>
                <pre className="mt-3 p-4 bg-[var(--border)]/30 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                  {record.questionnaireSnapshot}
                </pre>
              </details>
            )}
          </div>
        </>
      )}
    </section>
  );
}
