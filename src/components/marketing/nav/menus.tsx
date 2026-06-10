"use client";

import Link from "next/link";
import type { NavLink } from "./menu-data";

// Desktop hover panels for the nav: MegaMenu (two-column grouped catalog with a
// view-all footer, used by Portfolio and Services) and DropdownMenu (a narrow
// link list, used by About and Clients). Hover state lives in Nav itself; these
// only render the open panel.

type MenuGroup = {
  id: string;
  title: string;
  items: { slug: string; title: string }[];
};

export function MegaMenu({
  groups,
  hrefBase,
  viewAllHref,
  viewAllLabel,
}: {
  groups: MenuGroup[];
  hrefBase: string;
  viewAllHref: string;
  viewAllLabel: string;
}) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[760px]">
      <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.id}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
                {g.title}
              </div>
              <div className="flex flex-col">
                {g.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`${hrefBase}/${item.slug}`}
                    className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        <div className="col-span-2 pt-3 border-t border-[var(--border)] text-xs">
          <Link
            href={viewAllHref}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {viewAllLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DropdownMenu({ links }: { links: NavLink[] }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-56">
      <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-4 flex flex-col">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="py-1.5 text-sm hover:text-[var(--accent)] transition"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
