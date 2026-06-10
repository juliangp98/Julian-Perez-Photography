import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { listProjectsByEmail, type ClientRecordSafe } from "@/lib/clients";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  CLIENT_MILESTONES,
  clientMilestoneIndex,
  type ClientStatus,
} from "@/lib/client-status";
import { services } from "@/lib/content";
import { UMBRELLAS, type Umbrella } from "@/lib/types";
import PortalBundles from "@/components/portal/PortalBundles";
import PortalNewProjectForm from "@/components/forms/PortalNewProjectForm";
import { projectDisplayName } from "@/lib/project-name";
import SubNav, { CLIENT_TABS } from "@/components/ui/SubNav";

// The portal home: a menu of the signed-in person's projects, grouped by
// photographic category (umbrella) in the same card style as the services /
// galleries pages. Bundled projects are pulled into their own accent group so
// the linked relationship is obvious.
export const metadata: Metadata = {
  title: "Your projects",
  robots: { index: false, follow: false },
};

const SERVICE_UMBRELLA: Record<string, Umbrella> = Object.fromEntries(
  services.map((s) => [s.slug, s.umbrella]),
);
const UMBRELLA_TITLE: Record<string, string> = Object.fromEntries(
  UMBRELLAS.map((u) => [u.id, u.title]),
);

function ProjectCard({
  p,
  bundled,
}: {
  p: ClientRecordSafe;
  bundled?: boolean;
}) {
  const title = projectDisplayName(p);
  const milestone = clientMilestoneIndex(p.status);
  return (
    <Link
      href={`/portal/projects/${p.id}`}
      className={`block rounded-lg border bg-white p-5 transition ${
        bundled
          ? "border-[var(--accent)] hover:border-[var(--foreground)]"
          : "border-[var(--border)] hover:border-[var(--foreground)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-serif text-xl">{title}</div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--accent)] whitespace-nowrap">
          {CLIENT_STATUS_CLIENT_LABEL[p.status as ClientStatus] ?? "In progress"}
        </span>
      </div>
      {p.eventDate && (
        <div className="mt-2 text-sm text-[var(--muted)]">{p.eventDate}</div>
      )}
      {milestone >= 0 && (
        <div className="mt-3 flex items-center gap-1" aria-hidden>
          {CLIENT_MILESTONES.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= milestone ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            />
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function PortalProjectsMenuPage() {
  const session = await getSession();
  if (!session) redirect("/portal");
  const projects = await listProjectsByEmail(session.email);

  // Split bundled vs. loose. Bundles render first as their own accent groups;
  // the rest group by photographic category.
  const bundles = new Map<string, { label: string; items: ClientRecordSafe[] }>();
  const loose: ClientRecordSafe[] = [];
  for (const p of projects) {
    if (p.bundleId) {
      const b = bundles.get(p.bundleId) ?? {
        label: p.bundleLabel || "Bundle",
        items: [],
      };
      b.items.push(p);
      bundles.set(p.bundleId, b);
    } else {
      loose.push(p);
    }
  }

  // Group loose projects by umbrella, in the canonical umbrella order.
  const byUmbrella = new Map<string, ClientRecordSafe[]>();
  for (const p of loose) {
    const u = (p.serviceType && SERVICE_UMBRELLA[p.serviceType]) || "other";
    const arr = byUmbrella.get(u) ?? [];
    arr.push(p);
    byUmbrella.set(u, arr);
  }
  const orderedUmbrellas = [
    ...UMBRELLAS.map((u) => u.id as string),
    "other",
  ].filter((u) => byUmbrella.has(u));

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
      <div className="mt-8 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Your projects
      </div>
      <h1 className="mt-2 font-serif text-4xl">Welcome back</h1>
      <p className="mt-3 text-[var(--muted)]">
        Pick a project to see its status, dates, documents, and to add details.
      </p>

      <div className="mt-8">
        <PortalNewProjectForm />
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-[var(--muted)]">
          Nothing here yet. Once you&rsquo;ve inquired or started a
          questionnaire, your projects will show up here.
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {/* Bundles */}
          {[...bundles.entries()].map(([bundleId, b]) => (
            <div
              key={bundleId}
              className="rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--accent)]/[0.03] p-5 lg:p-6"
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--accent)]">↔</span>
                <h2 className="font-serif text-2xl">{b.label}</h2>
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Bundle
                </span>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {b.items.map((p) => (
                  <ProjectCard key={p.id} p={p} bundled />
                ))}
              </div>
            </div>
          ))}

          {/* Loose projects, grouped by photographic category */}
          {orderedUmbrellas.map((u) => (
            <div key={u}>
              <h2 className="font-serif text-2xl">
                {UMBRELLA_TITLE[u] ?? "Other"}
              </h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {byUmbrella.get(u)!.map((p) => (
                  <ProjectCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}

          {/* Link projects into a bundle */}
          {projects.length >= 2 && (
            <PortalBundles
              projects={projects.map((p) => ({
                id: p.id,
                title: projectDisplayName(p),
                bundleLabel: p.bundleLabel,
              }))}
            />
          )}
        </div>
      )}
    </section>
  );
}
