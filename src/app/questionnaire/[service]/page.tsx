import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  QUESTIONNAIRES,
  getQuestionnaire,
} from "@/lib/questionnaires";
import { getService, getSiteSettings } from "@/lib/content";
import QuestionnaireForm from "@/components/QuestionnaireForm";
import SubNav, { FUNNEL_TABS } from "@/components/SubNav";

export function generateStaticParams() {
  return Object.keys(QUESTIONNAIRES).map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  const q = getQuestionnaire(service);
  if (!q) return {};
  const url = `https://julianperezphotography.com/questionnaire/${service}`;
  return {
    title: q.title,
    description: q.intro,
    alternates: { canonical: url },
    openGraph: {
      title: q.title,
      description: q.intro,
      url,
      type: "website",
    },
    robots: { index: false, follow: true },
  };
}

export default async function QuestionnairePage({
  params,
  searchParams,
}: {
  params: Promise<{ service: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await params;
  const q = getQuestionnaire(service);
  if (!q) notFound();
  const [svc, sp, settings] = await Promise.all([
    getService(service),
    searchParams,
    getSiteSettings(),
  ]);

  // Carry query params into prefill, preserving arrays (repeated keys) so
  // multi-select / checkbox answers round-trip through cross-prefill — not just
  // single-value fields.
  const prefill: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k === "project") continue; // threaded separately as projectId
    if (typeof v === "string") prefill[k] = v;
    else if (Array.isArray(v)) prefill[k] = v;
  }
  const projectId = typeof sp.project === "string" ? sp.project : undefined;

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={FUNNEL_TABS} />

      <div className="mt-6 mb-12">
        {svc && (
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {svc.title}
          </div>
        )}
        <h1 className="mt-3 font-serif text-4xl">{q.title}</h1>
        <p className="mt-5 text-[var(--muted)]">{q.intro}</p>
      </div>

      <QuestionnaireForm
        questionnaire={q}
        prefill={prefill}
        calls={{
          planningCall: settings.calls.planningCall,
          weddingTimelineCall: settings.calls.weddingTimelineCall,
          venueWalkthrough: settings.calls.venueWalkthrough,
        }}
        projectId={projectId}
      />
    </section>
  );
}
