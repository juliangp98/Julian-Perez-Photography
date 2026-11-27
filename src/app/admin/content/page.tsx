import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import Panel from "@/components/ui/Panel";
import Badge from "@/components/ui/Badge";
import { Detail } from "@/components/ui/RailCard";
import GuidePicker from "@/components/admin/GuidePicker";
import GuideView from "@/components/admin/GuideView";
import ServiceCollections from "@/components/admin/ServiceCollections";
import CopyDrafter, { type CopySubject } from "@/components/admin/ai/CopyDrafter";
import AltDrafter, { type AltGallery } from "@/components/admin/ai/AltDrafter";
import { getServices, getVisibleServices, getVisiblePortfolios } from "@/lib/content";
import { getPortfolioAltOverrides } from "@/lib/portfolio-alt";
import { aiEnabled } from "@/lib/ai/ai";
import { discoveryGuide, guideFamilies, guideFamily, knownService } from "@/lib/discovery-guides";
import { GROUPED_TEMPLATES } from "@/lib/email/email-pipeline";
import { templateEffectsLine } from "@/lib/email/send-effects";
import { statusTitle } from "@/lib/labels";
import { serviceTitle } from "@/lib/services-data";
import type { ServiceCategory } from "@/lib/types";

// What Julian says to clients, to read in one place: the discovery-call guide
// for each kind of shoot, every email template by stage with what sending it
// does, and each service's collections. The website copy tools come last. The
// guides and templates live in code, so these are read-only.
export const metadata: Metadata = {
  title: "Content · Admin",
  robots: { index: false, follow: false },
};

const PAGE = "/admin/content";

// The page's tabs, in order, by their ?tab= value ("" for the call guides).
const TABS = [
  { key: "", label: "Call guides" },
  { key: "emails", label: "Emails" },
  { key: "collections", label: "Collections" },
  { key: "copy", label: "Website copy" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// One value from the address, ignoring a repeated key.
const one = (v?: string | string[]) => (typeof v === "string" ? v : undefined);

export default async function AdminContentPage({
  searchParams,
}: {
  // ?tab= picks the tab; on the call guides, ?service=<slug> picks the guide.
  searchParams: Promise<{ tab?: string | string[]; service?: string | string[] }>;
}) {
  if (!(await getAdminSession())) redirect("/admin");
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: TabKey = TABS.find((t) => t.key && t.key === tabParam)?.key ?? "";

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <h1 className="mt-8 font-serif text-4xl">Content</h1>
      <p className="mt-2 text-muted">
        What you say to clients: the call guides, the emails and the collections. The guides and emails live in the
        site&rsquo;s code, so they read here exactly as they do on a project.
      </p>

      <div className="mt-8">
        <SubNav
          label="Content"
          items={TABS.map((t) => ({ label: t.label, href: t.key ? `${PAGE}?tab=${t.key}` : PAGE }))}
          activeHref={tab ? `${PAGE}?tab=${tab}` : PAGE}
        />
      </div>

      {tab === "" && <CallGuides service={one(sp.service)} />}
      {tab === "emails" && <Emails />}
      {tab === "collections" && <Collections />}
      {tab === "copy" && <WebsiteCopy />}
    </section>
  );
}

// A service's name from the live catalog, else the built-in one.
function titleOf(slug: string, services: ServiceCategory[]) {
  return services.find((s) => s.slug === slug)?.title || serviceTitle(slug) || slug;
}

async function CallGuides({ service }: { service?: string }) {
  const services = await getServices();
  const slug = knownService(service);
  const hidden = new Set(services.filter((s) => s.hidden).map((s) => s.slug));
  const groups = guideFamilies().map(({ family, services: slugs }) => ({
    label: family.label,
    options: slugs.map((s) => ({
      value: s,
      label: hidden.has(s) ? `${titleOf(s, services)} (hidden on the site)` : titleOf(s, services),
    })),
  }));
  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        Each guide reads as it does on a project&rsquo;s Call tab, where the date check and the service&rsquo;s
        collections sit above it.
      </p>
      <GuidePicker value={slug ?? ""} groups={groups} />
      <p className="text-sm">
        {slug
          ? `${titleOf(slug, services)} projects use the ${guideFamily(slug).label.toLowerCase()} guide.`
          : "Projects with no service yet use the general guide."}
      </p>
      <GuideView guide={discoveryGuide(slug)} />
    </div>
  );
}

function Emails() {
  return (
    <div className="mt-8 space-y-10">
      <p className="text-sm text-muted">
        {
          "Every email template, grouped by stage, as Compose starts it. Tokens like {{firstName}} fill in from the project, and the [brackets] are yours to finish. To send one, open the project and use Compose on its Messages tab."
        }
      </p>
      {GROUPED_TEMPLATES.map((g, i) => (
        <div key={`${i}-${g.stage}`}>
          <h2 className="font-serif text-2xl">{statusTitle(g.stage)}</h2>
          <div className="mt-4 space-y-3">
            {g.items.map((t) => (
              <Panel key={t.id}>
                <details>
                  <summary className="cursor-pointer list-none">
                    <span className="block font-medium">{t.name}</span>
                    <span className="mt-1 block text-xs text-muted">{templateEffectsLine(t)}</span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    <Detail label="Subject" value={t.subject} />
                    <Detail label="Body" value={t.body} preLine />
                  </div>
                </details>
              </Panel>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function Collections() {
  const services = await getServices();
  const ordered = [...services.filter((s) => !s.hidden), ...services.filter((s) => s.hidden)];
  return (
    <div className="mt-8 space-y-3">
      <p className="text-sm text-muted">
        Each service&rsquo;s collections as the site lists them, with the booking terms set in Studio. Hidden
        services come last.
      </p>
      {ordered.map((s) => {
        const count = s.packages?.length ?? 0;
        return (
          <Panel key={s.slug}>
            <details>
              <summary className="cursor-pointer list-none">
                <span className="font-medium">{s.title}</span>
                {s.hidden && (
                  <Badge tone="muted" className="ml-2">
                    Hidden on the site
                  </Badge>
                )}
                <span className="ml-2 text-sm text-muted">
                  {count ? `${count} ${count === 1 ? "collection" : "collections"}` : "No collections yet"}
                </span>
              </summary>
              <div className="mt-4">
                <ServiceCollections service={s} />
              </div>
            </details>
          </Panel>
        );
      })}
    </div>
  );
}

async function WebsiteCopy() {
  if (!aiEnabled()) {
    return (
      <div className="mt-8 p-6 border border-dashed border-border rounded-lg text-sm text-muted">
        AI drafting isn&rsquo;t configured. Set <code>GROQ_API_KEY</code> to enable it (see the README). You can always
        edit content directly in{" "}
        <Link href="/studio" className="underline underline-offset-4">
          Studio
        </Link>
        .
      </div>
    );
  }
  const [services, portfolios, altOverrides] = await Promise.all([
    getVisibleServices(),
    getVisiblePortfolios(),
    getPortfolioAltOverrides(),
  ]);
  // The drafter's pages are the ones the site shows.
  const subjects: CopySubject[] = [
    ...services.map((s) => ({ kind: "service" as const, slug: s.slug, title: s.title })),
    ...portfolios.map((p) => ({ kind: "portfolio" as const, slug: p.slug, title: p.title })),
  ];
  // Photo galleries only (a video portfolio has no stills to describe), Studio
  // and Lightroom alike, each image with its alt as shown: a saved override,
  // else the image's own.
  const galleries: AltGallery[] = portfolios
    .filter((p) => !Array.isArray(p.videos))
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      images: p.images.map((img) => ({ src: img.src, alt: altOverrides[img.src] ?? img.alt })),
    }));
  return (
    <div className="mt-8 space-y-14">
      <div>
        <h2 className="font-serif text-2xl">Journal posts and page copy</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Give it a topic for a new journal post, or pick a page to tighten or rewrite from what&rsquo;s live. Review
          the draft, then publish it in Studio. Nothing goes live until you do it there.
        </p>
        <CopyDrafter subjects={subjects} />
      </div>
      <div className="pt-8 border-t border-border">
        <h2 className="font-serif text-2xl">Portfolio image alt text</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Describe gallery photos for screen readers and search. It&rsquo;s the quick way to fill in alt text for a
          batch you uploaded in Studio, for Studio and Lightroom galleries alike: generate, edit and save. Saved text
          replaces the photo&rsquo;s own alt on the site and survives re-imports.
        </p>
        <AltDrafter galleries={galleries} />
      </div>
    </div>
  );
}
