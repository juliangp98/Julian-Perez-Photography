import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/auth-cookies";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import Panel from "@/components/ui/Panel";
import Badge from "@/components/ui/Badge";
import CopyField from "@/components/ui/CopyField";
import { getServices, getSiteSettings } from "@/lib/content";
import { TOOLS, notSetLine, sharedLinks, siteServices, type ServiceLink } from "@/lib/admin-links";
import { unfinishedSetup } from "@/lib/config";

// What Julian shares and what he uses: the links he sends clients (each with
// a Copy action), the tools he works in, and the services the site runs on
// with whether each is set up, including any setting production still needs.
export const metadata: Metadata = {
  title: "Links · Admin",
  robots: { index: false, follow: false },
};

// A dashboard or tool as a card: its link, what it's for, and anything the
// page adds (a set-up badge).
function ServiceCard({ link, children }: { link: ServiceLink; children?: ReactNode }) {
  const cls = "font-medium underline-offset-4 hover:underline";
  return (
    <Panel className="h-full">
      {link.internal ? (
        <Link href={link.href} className={cls}>
          {link.label}{" "}
          <span aria-hidden className="text-muted">
            →
          </span>
        </Link>
      ) : (
        <a href={link.href} target="_blank" rel="noreferrer" className={cls}>
          {link.label}{" "}
          <span aria-hidden className="text-muted">
            ↗
          </span>
        </a>
      )}
      <p className="mt-2 text-sm text-muted leading-relaxed">{link.desc}</p>
      {children}
    </Panel>
  );
}

export default async function AdminLinksPage() {
  if (!(await getAdminSession())) redirect("/admin");
  const [settings, services] = await Promise.all([getSiteSettings(), getServices()]);
  const groups = sharedLinks(settings, services);
  const setup = unfinishedSetup();

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <h1 className="mt-8 font-serif text-4xl">Links</h1>
      <p className="mt-2 text-muted">
        What you share with clients, the tools you work in, and the services the site runs on.
      </p>

      <div className="mt-10 space-y-14">
        <section aria-labelledby="share-heading">
          <h2 id="share-heading" className="font-serif text-2xl">
            Links you share
          </h2>
          <p className="mt-1 text-sm text-muted">
            Copy one into an email or a message. They come from site settings and services in{" "}
            <Link href="/studio" className="underline underline-offset-4 hover:text-accent">
              Studio
            </Link>
            .
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {groups.map((g) => (
              <Panel key={g.title} className="space-y-3">
                <h3 className="font-serif text-xl">{g.title}</h3>
                <p className="text-sm text-muted">{g.note}</p>
                {g.links.map((l, i) => (
                  <CopyField key={`${i}-${l.label}`} label={l.label} value={l.value} href={l.href} />
                ))}
                {g.missing.length > 0 && <p className="text-sm text-muted">{notSetLine(g.missing)}</p>}
              </Panel>
            ))}
          </div>
        </section>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="font-serif text-2xl">
            Tools you use
          </h2>
          <p className="mt-1 text-sm text-muted">Where the work happens day to day.</p>
          <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <li key={t.label}>
                <ServiceCard link={t} />
              </li>
            ))}
          </ul>
        </section>

        {/* Open when production still needs a setting, so the list is in view. */}
        <details open={setup.length > 0 || undefined}>
          <summary className="cursor-pointer list-none">
            <h2 className="inline font-serif text-2xl">Site services</h2>
            <span className="ml-3 text-sm text-muted">The dashboards behind the site, and whether each is set up.</span>
          </summary>
          <div className="mt-6 space-y-10">
            {setup.length > 0 && (
              <div id="setup">
                <Panel tone="danger">
                  <h3 className="font-serif text-xl text-danger">Setup isn&rsquo;t finished</h3>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {setup.map((s) => (
                      <li key={s.name}>
                        <code>{s.name}</code> <span className="text-muted">{s.without}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted">
                    Set these in Vercel, then redeploy. docs/configuration.md lists them all.
                  </p>
                </Panel>
              </div>
            )}
            {siteServices().map((g) => (
              <div key={g.title}>
                <h3 className="font-serif text-xl">{g.title}</h3>
                <ul className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <ServiceCard link={l}>
                        {l.settings?.length ? (
                          <div className="mt-3 text-sm">
                            {l.missing.length ? (
                              <>
                                <Badge tone="warn">Not set</Badge>
                                <span className="ml-2 text-muted">
                                  Missing:{" "}
                                  {l.missing.map((name, i) => (
                                    <span key={name}>
                                      {i > 0 && ", "}
                                      <code>{name}</code>
                                    </span>
                                  ))}
                                </span>
                              </>
                            ) : (
                              <Badge tone="good">Configured</Badge>
                            )}
                          </div>
                        ) : null}
                      </ServiceCard>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
