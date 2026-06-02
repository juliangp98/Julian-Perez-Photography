import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { listClients, type ClientRecordFull } from "@/lib/clients";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import AdminNav from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Projects — Admin",
  robots: { index: false, follow: false },
};

const STATUS_TITLE: Record<string, string> = Object.fromEntries(
  CLIENT_STATUS_OPTIONS.map((s) => [s.value, s.title]),
);

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
  { key: "archived", title: "Archived & lost", statuses: ["archived", "lost"] },
];

function ProjectCard({ r }: { r: ClientRecordFull }) {
  return (
    <Link
      href={`/admin/projects/${r.id}`}
      className="block rounded-lg border border-[var(--border)] bg-white p-5 hover:border-[var(--foreground)] transition"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-serif text-xl">{r.clientName || "(no name)"}</div>
        <span className="text-[10px] uppercase tracking-widest text-[var(--accent)] whitespace-nowrap">
          {STATUS_TITLE[r.status ?? ""] ?? r.status}
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
  );
}

export default async function AdminProjectsPage() {
  if (!(await getAdminSession())) redirect("/admin");
  const all = await listClients();
  const known = new Set(GROUPS.flatMap((g) => g.statuses));
  const other = all.filter((r) => !known.has(r.status ?? ""));

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <AdminNav active="projects" />
      <h1 className="mt-8 font-serif text-4xl">Projects</h1>
      <p className="mt-2 text-[var(--muted)]">
        {all.length} record{all.length === 1 ? "" : "s"} · grouped by status
      </p>

      {all.length === 0 ? (
        <div className="mt-12 p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-[var(--muted)]">
          No client records yet. Inquiries and questionnaire submissions appear
          here automatically once the Supabase store is configured.
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {GROUPS.map((g) => {
            const items = all.filter((r) => g.statuses.includes(r.status ?? ""));
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
