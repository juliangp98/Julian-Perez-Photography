import {
  contactLine,
  daysUntil,
  formatEventDate,
  formatHumanDate,
  studioToday,
} from "@/lib/field-format";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { listClients, type ClientRecordFull } from "@/lib/clients";
import { statusTitle } from "@/lib/labels";
import { serviceTitle } from "@/lib/services-data";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import { projectDisplayName } from "@/lib/project-name";
import ProjectSearch from "@/components/admin/ProjectSearch";
import TodayList from "@/components/admin/TodayList";
import NewProjectForm from "@/components/forms/NewProjectForm";
import Badge from "@/components/ui/Badge";
import { aiEnabled } from "@/lib/ai/ai";
import { getServices } from "@/lib/content";
import { QUESTIONNAIRES } from "@/lib/questionnaires";
import { todayRows } from "@/lib/today";
import { heldUntil } from "@/lib/email/send-effects";
import Panel from "@/components/ui/Panel";
import { unfinishedSetup } from "@/lib/config";

export const metadata: Metadata = {
  title: "Projects · Admin",
  robots: { index: false, follow: false },
};

// The board's phases, in pipeline order. Closed projects start folded away.
const PHASES: { key: string; title: string; statuses: string[]; folded?: boolean }[] = [
  {
    key: "leads",
    title: "Leads",
    statuses: ["new-inquiry", "responded", "in-conversation", "proposal-sent"],
  },
  { key: "booked", title: "Booked", statuses: ["booked", "contract-signed", "planning", "scheduled"] },
  { key: "production", title: "In production", statuses: ["shot", "editing"] },
  { key: "delivered", title: "Delivered", statuses: ["delivered", "complete"] },
  { key: "closed", title: "Closed", statuses: ["archived", "lost", "declined"], folded: true },
];

// What's next on a project, in one line: its follow-up, or a date hold.
function nextLine(r: ClientRecordFull, today: string): string | null {
  if (r.followUpAt) {
    return `Follow up ${formatHumanDate(r.followUpAt, { month: "short" })}${r.followUpNote ? `: ${r.followUpNote}` : ""}`;
  }
  const hold = heldUntil(r, undefined, today);
  return hold ? `Date held until ${formatHumanDate(hold.until, { month: "short" })}` : null;
}

function ProjectCard({ r, today }: { r: ClientRecordFull; today: string }) {
  const next = nextLine(r, today);
  const contact = contactLine(r.lastInAt, r.lastOutAt, today);
  return (
    <Panel className="hover:border-foreground transition">
      <Link href={`/admin/projects/${r.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="font-serif text-xl">{projectDisplayName(r)}</div>
          <Badge tone="muted" className="whitespace-nowrap">
            {statusTitle(r.status)}
          </Badge>
        </div>
        <div className="mt-2 text-sm text-muted">
          {[serviceTitle(r.serviceType), formatEventDate(r.eventDate, { month: "short" })]
            .filter(Boolean)
            .join(" · ") || "No service or date yet"}
        </div>
        {next && <div className="mt-1 text-sm">{next}</div>}
        {contact && <div className="mt-1 text-xs text-muted">{contact}</div>}
        {r.bundleLabel && (
          <div className="mt-2 inline-block px-2 py-0.5 rounded-full border border-accent text-accent text-[10px] uppercase tracking-widest">
            ↔ {r.bundleLabel}
          </div>
        )}
      </Link>
    </Panel>
  );
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; service?: string }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // Every word has to be there, in any order.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const serviceFilter = sp.service ?? "";

  const [all, catalog] = await Promise.all([listClients(), getServices()]);
  const today = studioToday();

  // Today: what needs the owner now, from every project, whatever the filters.
  const terms = new Map(
    catalog.map((svc) => [
      svc.slug as string,
      { turnaroundDays: svc.turnaroundDays, questionnaire: svc.slug in QUESTIONNAIRES },
    ]),
  );
  const rows = todayRows(
    all.map((r) => ({ ...r, name: projectDisplayName(r) })),
    today,
    (slug) => (slug ? terms.get(slug) : undefined),
  );

  // Service options for the dropdown — the distinct service types in play.
  const services = [
    ...new Set(all.map((r) => r.serviceType).filter(Boolean) as string[]),
  ]
    .sort()
    .map((s) => ({ value: s, label: serviceTitle(s) ?? s }));

  const filtered = all.filter((r) => {
    if (serviceFilter && (r.serviceType ?? "") !== serviceFilter) return false;
    if (words.length) {
      const hay = [
        r.clientName,
        r.email,
        r.serviceType,
        serviceTitle(r.serviceType),
        r.projectName,
        projectDisplayName(r),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  const hasFilters = !!(q || serviceFilter);
  const known = new Set(PHASES.flatMap((g) => g.statuses));
  const other = filtered.filter((r) => !known.has(r.status ?? ""));

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <h1 className="mt-8 font-serif text-4xl">Projects</h1>
      <p className="mt-2 text-muted">
        {hasFilters
          ? `${filtered.length} of ${all.length} project${all.length === 1 ? "" : "s"}`
          : `${all.length} project${all.length === 1 ? "" : "s"}`}
      </p>

      {/* What's missing is listed on the Links page; the board points to it. */}
      {unfinishedSetup().length > 0 && (
        <p className="mt-6 text-sm text-danger">
          Setup isn&rsquo;t finished.{" "}
          <Link href="/admin/links#setup" className="underline underline-offset-4">
            See what&rsquo;s missing
          </Link>
        </p>
      )}

      <div className="mt-8">
        <TodayList rows={rows} today={today} />
      </div>

      <div className="mt-6">
        <NewProjectForm />
      </div>

      {all.length > 0 && (
        <div className="mt-8">
          <ProjectSearch
            initialQuery={q}
            initialService={serviceFilter}
            services={services}
            canAsk={aiEnabled()}
            filtered={hasFilters}
          />
        </div>
      )}

      {all.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-border rounded-lg text-center text-muted">
          No client records yet. Inquiries and questionnaire submissions appear
          here automatically once the Supabase store is configured.
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-border rounded-lg text-center text-muted">
          No projects match your search.{" "}
          <Link
            href="/admin/projects"
            className="underline hover:text-foreground"
          >
            Clear it
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {PHASES.map((g) => {
            const items = filtered.filter((r) => g.statuses.includes(r.status ?? ""));
            if (items.length === 0) return null;
            // Booked shoots read soonest first; the rest keep the latest activity first.
            if (g.key === "booked") {
              items.sort((a, b) => (daysUntil(a.eventDate) ?? 1e9) - (daysUntil(b.eventDate) ?? 1e9));
            }
            const grid = (
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <ProjectCard key={r.id} r={r} today={today} />
                ))}
              </div>
            );
            const heading = (
              <>
                {g.title} <span className="text-base text-muted">({items.length})</span>
              </>
            );
            return g.folded ? (
              <details key={g.key}>
                <summary className="cursor-pointer">
                  <h2 className="inline font-serif text-2xl">{heading}</h2>
                </summary>
                {grid}
              </details>
            ) : (
              <div key={g.key}>
                <h2 className="font-serif text-2xl">{heading}</h2>
                {grid}
              </div>
            );
          })}
          {other.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl">Other</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {other.map((r) => (
                  <ProjectCard key={r.id} r={r} today={today} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
