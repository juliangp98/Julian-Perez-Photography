import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import AdminNav from "@/components/AdminNav";
import JournalDrafter from "@/components/JournalDrafter";
import CopyPolisher, { type CopySubject } from "@/components/CopyPolisher";
import MetaDrafter from "@/components/MetaDrafter";
import { getVisibleServices, getVisiblePortfolios } from "@/lib/content";
import { aiEnabled } from "@/lib/ai";

export const metadata: Metadata = {
  title: "Content tools — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminContentPage() {
  if (!(await getAdminSession())) redirect("/admin");
  const ai = aiEnabled();

  // The copy tool's dropdown is server-loaded from the live catalog.
  let subjects: CopySubject[] = [];
  if (ai) {
    const [services, portfolios] = await Promise.all([
      getVisibleServices(),
      getVisiblePortfolios(),
    ]);
    subjects = [
      ...services.map((s) => ({
        kind: "service" as const,
        slug: s.slug,
        title: s.title,
      })),
      ...portfolios.map((p) => ({
        kind: "portfolio" as const,
        slug: p.slug,
        title: p.title,
      })),
    ];
  }

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
      <AdminNav active="content" />
      <h1 className="mt-8 font-serif text-4xl">Content tools</h1>
      <p className="mt-2 text-[var(--muted)]">
        Draft journal posts and polish your page copy with AI, then review and
        publish in Studio. Nothing goes live until you do it there.
      </p>

      {!ai ? (
        <div className="mt-8 p-6 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)]">
          AI drafting isn&rsquo;t configured. Set <code>GROQ_API_KEY</code> to
          enable it (see the README). You can always edit content directly in{" "}
          <Link href="/studio" className="underline underline-offset-4">
            Studio
          </Link>
          .
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          <div>
            <h2 className="font-serif text-2xl">Journal post drafts</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
              From a topic or brief — a title, excerpt, body, and tags to paste
              into a new post.
            </p>
            <JournalDrafter />
          </div>
          <div className="pt-8 border-t border-[var(--border)]">
            <h2 className="font-serif text-2xl">Service &amp; portfolio copy</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
              Tighten or rewrite a page&rsquo;s tagline, description, and intro
              from what&rsquo;s currently live.
            </p>
            <CopyPolisher subjects={subjects} />
          </div>
          <div className="pt-8 border-t border-[var(--border)]">
            <h2 className="font-serif text-2xl">Page meta descriptions</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
              SEO snippets for the main pages (~150&ndash;160 characters), to
              apply to each page&rsquo;s metadata.
            </p>
            <MetaDrafter />
          </div>
        </div>
      )}
    </section>
  );
}
