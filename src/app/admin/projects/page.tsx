import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { listClients, type ClientRecordFull } from "@/lib/clients";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import { statusTitle } from "@/lib/labels";
import { serviceTitle } from "@/lib/services-data";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import AdminQuickLog from "@/components/admin/AdminQuickLog";
import { projectDisplayName } from "@/lib/project-name";
import AdminSearch from "@/components/admin/AdminSearch";
import NewProjectForm from "@/components/forms/NewProjectForm";
import { compactInputClass } from "@/components/ui/fields/Field";
import { submitButtonClass } from "@/components/ui/Button";
import { aiEnabled } from "@/lib/ai/ai";
import Panel from "@/components/ui/Panel";

export const metadata: Metadata = {
  title: "Projects — Admin",
  robots: { index: false, follow: false },
};

// Status groupings — mirrors the pipeline so the overview reads like a board.
const GROUPS: { key: string; title: string; statuses: string[] }[] = [
  { key: "new", title: "New inquiries", statuses: ["new-inquiry"] },
  {
    key: "active",
    title: "Active",
    statuses: [
      "responded",
      "in-conversation",
      "proposal-sent",
      "booked",
      "contract-signed",
      "planning",
      "scheduled",
      "shot",
      "editing",
    ],
  },
  { key: "delivered", title: "Delivered & complete", statuses: ["delivered", "complete"] },
  {
    key: "archived",
    title: "Archived, lost & declined",
    statuses: ["archived", "lost", "declined"],
  },
];

// Day delta from today for an event-date string (ISO / M/D/Y / "Mon D, YYYY");
// null if unparseable, negative if past.
function daysFromToday(d?: string): number | null {
  if (!d) return null;
  let date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((t1.getTime() - t0.getTime()) / 86_400_000);
}

// Days elapsed since an ISO timestamp; null if unparseable. (Kept in a helper so
// the "now" read stays out of the component render body.)
function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (new Date().getTime() - t) / 86_400_000;
}

function ProjectCard({ r }: { r: ClientRecordFull }) {
  return (
    <Panel className="hover:border-[var(--foreground)] transition">
      <Link href={`/admin/projects/${r.id}`} className="block">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-serif text-xl">{projectDisplayName(r)}</div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--accent)] whitespace-nowrap">
            {statusTitle(r.status)}
          </span>
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          {[r.serviceType, r.eventDate].filter(Boolean).join(" · ") || "—"}
        </div>
        {r.email && (
          <div className="mt-1 text-xs text-[var(--muted)]">{r.email}</div>
        )}
        {r.bundleLabel && (
          <div className="mt-2 inline-block px-2 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)] text-[10px] uppercase tracking-widest">
            ↔ {r.bundleLabel}
          </div>
        )}
      </Link>
      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        <AdminQuickLog projectId={r.id} currentStatus={r.status} />
      </div>
    </Panel>
  );
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; service?: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const qLower = q.toLowerCase();
  const statusFilter = sp.status ?? "";
  const serviceFilter = sp.service ?? "";

  const all = await listClients();

  // Needs attention — computed from the full list, independent of filters.
  const staleInquiries = all.filter(
    (r) => r.status === "new-inquiry" && (daysSince(r.updatedAt) ?? 0) > 3,
  );
  const DONE_STATUSES = new Set([
    "delivered",
    "complete",
    "archived",
    "lost",
    "declined",
  ]);
  const upcomingShoots = all
    .filter((r) => !DONE_STATUSES.has(r.status ?? ""))
    .map((r) => ({ r, days: daysFromToday(r.eventDate) }))
    .filter((x): x is { r: ClientRecordFull; days: number } =>
      x.days !== null && x.days >= 0 && x.days <= 30,
    )
    .sort((a, b) => a.days - b.days);

  // Service options for the dropdown — the distinct service types in play.
  const services = [
    ...new Set(all.map((r) => r.serviceType).filter(Boolean) as string[]),
  ].sort();

  const filtered = all.filter((r) => {
    if (statusFilter && (r.status ?? "") !== statusFilter) return false;
    if (serviceFilter && (r.serviceType ?? "") !== serviceFilter) return false;
    if (qLower) {
      const hay = [r.clientName, r.email, r.serviceType, r.projectName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    return true;
  });

  const hasFilters = !!(q || statusFilter || serviceFilter);
  const known = new Set(GROUPS.flatMap((g) => g.statuses));
  const other = filtered.filter((r) => !known.has(r.status ?? ""));

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <h1 className="mt-8 font-serif text-4xl">Projects</h1>
      <p className="mt-2 text-[var(--muted)]">
        {hasFilters
          ? `${filtered.length} of ${all.length} record${all.length === 1 ? "" : "s"}`
          : `${all.length} record${all.length === 1 ? "" : "s"} · grouped by status`}
      </p>

      <div className="mt-6">
        <NewProjectForm />
      </div>

      {(staleInquiries.length > 0 || upcomingShoots.length > 0) && (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {staleInquiries.length > 0 && (
            <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.04] p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                Awaiting a reply ({staleInquiries.length})
              </div>
              <ul className="mt-3 space-y-1.5">
                {staleInquiries.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm">
                    <Link
                      href={`/admin/projects/${r.id}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {projectDisplayName(r)}
                    </Link>
                  </li>
                ))}
              </ul>
              {staleInquiries.length > 5 && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  + {staleInquiries.length - 5} more
                </p>
              )}
            </div>
          )}
          {upcomingShoots.length > 0 && (
            <Panel>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Upcoming shoots ({upcomingShoots.length})
              </div>
              <ul className="mt-3 space-y-1.5">
                {upcomingShoots.slice(0, 5).map(({ r, days }) => (
                  <li
                    key={r.id}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <Link
                      href={`/admin/projects/${r.id}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {projectDisplayName(r)}
                    </Link>
                    <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                      {days === 0
                        ? "today"
                        : days === 1
                          ? "tomorrow"
                          : `in ${days} days`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {aiEnabled() && all.length > 0 && (
        <div className="mt-8">
          <AdminSearch />
        </div>
      )}

      {all.length > 0 && (
        <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, service…"
            aria-label="Search projects"
            className={`flex-1 min-w-[200px] ${compactInputClass}`}
          />
          <select
            name="status"
            defaultValue={statusFilter}
            aria-label="Filter by status"
            className={compactInputClass}
          >
            <option value="">All statuses</option>
            {CLIENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.title}
              </option>
            ))}
          </select>
          {services.length > 0 && (
            <select
              name="service"
              defaultValue={serviceFilter}
              aria-label="Filter by service"
              className={`${compactInputClass} capitalize`}
            >
              <option value="">All services</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {serviceTitle(s)}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className={submitButtonClass}>
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/admin/projects"
              className="text-xs uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Clear
            </Link>
          )}
        </form>
      )}

      {all.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-[var(--muted)]">
          No client records yet. Inquiries and questionnaire submissions appear
          here automatically once the Supabase store is configured.
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-[var(--muted)]">
          No projects match your filters.{" "}
          <Link
            href="/admin/projects"
            className="underline hover:text-[var(--foreground)]"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {GROUPS.map((g) => {
            const items = filtered.filter((r) =>
              g.statuses.includes(r.status ?? ""),
            );
            if (items.length === 0) return null;
            return (
              <div key={g.key}>
                <h2 className="font-serif text-2xl">
                  {g.title}{" "}
                  <span className="text-base text-[var(--muted)]">
                    ({items.length})
                  </span>
                </h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => (
                    <ProjectCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            );
          })}
          {other.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl">Other</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {other.map((r) => (
                  <ProjectCard key={r.id} r={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
