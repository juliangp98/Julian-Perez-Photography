import Link from "next/link";

// Sub-navigation shared across the admin area.
export default function AdminNav({ active }: { active: "projects" | "links" }) {
  const cls = (key: "projects" | "links") =>
    `text-xs uppercase tracking-[0.2em] ${
      active === key
        ? "text-[var(--foreground)]"
        : "text-[var(--muted)] hover:text-[var(--foreground)]"
    }`;
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[var(--border)] pb-4">
      <div className="flex gap-6">
        <Link href="/admin/projects" className={cls("projects")}>
          Projects
        </Link>
        <Link href="/admin/links" className={cls("links")}>
          External links
        </Link>
      </div>
      <Link
        href="/admin/logout"
        className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        Sign out
      </Link>
    </div>
  );
}
