import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import AdminNav from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "External links — Admin",
  robots: { index: false, follow: false },
};

// Every external service this site depends on, grouped by area. Dashboard
// links route to the right project after login, so no project-specific URLs
// are hard-coded (which would rot).
const GROUPS: {
  title: string;
  links: { label: string; href: string; desc: string; internal?: boolean }[];
}[] = [
  {
    title: "Hosting & deployment",
    links: [
      {
        label: "Vercel — Dashboard",
        href: "https://vercel.com/dashboard",
        desc: "Deployments, environment variables, domains, logs, Web Analytics, firewall.",
      },
    ],
  },
  {
    title: "Site Content (Sanity)",
    links: [
      {
        label: "Sanity — Manage",
        href: "https://www.sanity.io/manage",
        desc: "Project settings, API tokens, datasets, members, revalidation webhook.",
      },
      {
        label: "Sanity Studio (this site)",
        href: "/studio",
        desc: "Edit journal posts, services, portfolios, site settings, and the About page.",
        internal: true,
      },
    ],
  },
  {
    title: "Client data (Supabase)",
    links: [
      {
        label: "Supabase — Dashboard",
        href: "https://supabase.com/dashboard",
        desc: "The `client_records` table editor, SQL editor, and API keys for the CRM/portal.",
      },
    ],
  },
  {
    title: "Messaging",
    links: [
      {
        label: "Resend",
        href: "https://resend.com/overview",
        desc: "Inquiry / questionnaire / portal emails — domains, API keys, delivery activity.",
      },
      {
        label: "Twilio — Console",
        href: "https://console.twilio.com",
        desc: "Optional SMS confirmations — phone numbers, usage, auth token.",
      },
    ],
  },
  {
    title: "APIs & embedded tools",
    links: [
      {
        label: "Google Cloud Console",
        href: "https://console.cloud.google.com",
        desc: "Places API (New) key + restrictions, billing, daily quota.",
      },
      {
        label: "Square — Dashboard",
        href: "https://squareup.com/dashboard",
        desc: "Appointments booking embedded at /book.",
      },
      {
        label: "Pic-Time",
        href: "https://www.pic-time.com",
        desc: "Client galleries embedded at /client.",
      },
    ],
  },
  {
    title: "Monitoring & code",
    links: [
      {
        label: "Sentry",
        href: "https://sentry.io",
        desc: "Error + performance monitoring and session replay.",
      },
      {
        label: "GitHub — Repository",
        href: "https://github.com/juliangp98/Julian-Perez-Photography",
        desc: "Source, branches, pull requests, Actions, secrets.",
      },
    ],
  },
  {
    title: "SEO & security tools",
    links: [
      {
        label: "Google Search Console",
        href: "https://search.google.com/search-console",
        desc: "Indexing status, sitemap submission, search performance.",
      },
      {
        label: "Rich Results Test",
        href: "https://search.google.com/test/rich-results",
        desc: "Validate the LocalBusiness / FAQ / Service JSON-LD.",
      },
      {
        label: "HSTS Preload",
        href: "https://hstspreload.org",
        desc: "Submit the domain once HSTS has soaked for 30 days.",
      },
    ],
  },
];

export default async function AdminLinksPage() {
  if (!(await getAdminSession())) redirect("/admin");

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <AdminNav active="links" />
      <h1 className="mt-8 font-serif text-4xl">External links</h1>
      <p className="mt-2 text-[var(--muted)]">
        Every service this site connects to, in one place.
      </p>

      <div className="mt-10 space-y-14">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h2 className="font-serif text-2xl">{g.title}</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {g.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  {...(l.internal
                    ? {}
                    : { target: "_blank", rel: "noreferrer" })}
                  className="block rounded-lg border border-[var(--border)] bg-white p-5 hover:border-[var(--foreground)] transition"
                >
                  <div className="font-medium">
                    {l.label}{" "}
                    <span className="text-[var(--muted)]">
                      {l.internal ? "→" : "↗"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                    {l.desc}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
