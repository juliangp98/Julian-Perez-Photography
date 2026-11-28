import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  QUESTIONNAIRES,
  getQuestionnaire,
} from "@/lib/questionnaires";
import { getService, getSiteSettings } from "@/lib/content";
import { aiEnabled } from "@/lib/ai/ai";
import QuestionnaireForm from "@/components/forms/QuestionnaireForm";
import { knownDetails } from "@/lib/form-key";
import { SITE_URL } from "@/lib/site-settings-data";
import SubNav, { FUNNEL_TABS } from "@/components/ui/SubNav";

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
  const url = `${SITE_URL}/questionnaire/${service}`;
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

  // A project's link (?project=&key=) opens with what the project knows about
  // the client, read here (src/lib/form-key.ts). Query params prefill too, so
  // an older link and a bundle's cross-prefill still work; arrays (repeated
  // keys) carry multi-select answers.
  const projectId = typeof sp.project === "string" ? sp.project : undefined;
  const key = typeof sp.key === "string" ? sp.key : undefined;
  const prefill: Record<string, string | string[]> = { ...(await knownDetails(projectId, key, "questionnaire")) };
  for (const [k, v] of Object.entries(sp)) {
    if (k === "project" || k === "key") continue; // threaded separately
    if (typeof v === "string") prefill[k] = v;
    else if (Array.isArray(v)) prefill[k] = v;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={FUNNEL_TABS} />

      <div className="mx-auto max-w-3xl">
        <div className="mt-6 mb-12">
          {svc && (
            <div className="text-xs uppercase tracking-[0.2em] text-accent">
              {svc.title}
            </div>
          )}
          <h1 className="mt-3 font-serif text-4xl">{q.title}</h1>
          <p className="mt-5 text-muted">{q.intro}</p>
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
          aiEnabled={aiEnabled()}
        />
      </div>
    </section>
  );
}
