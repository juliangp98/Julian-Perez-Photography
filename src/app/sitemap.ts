import type { MetadataRoute } from "next";
import { getVisiblePortfolios, getVisibleServices } from "@/lib/content";
import { QUESTIONNAIRES } from "@/lib/questionnaires";

const BASE = "https://julianperezphotography.com";

// Async after round 14b.2 — services come from Sanity at request time
// (60s revalidate). Round 14c added portfolios to the same pattern, so
// both fetches now run in parallel under React's `cache()`.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    "",
    "/portfolio",
    "/services",
    "/about",
    "/inquire",
    "/book",
    "/questionnaire",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
  }));
  const [portfolios, services] = await Promise.all([
    getVisiblePortfolios(),
    getVisibleServices(),
  ]);
  const portfolioRoutes = portfolios.map((p) => ({
    url: `${BASE}/portfolio/${p.slug}`,
    lastModified: now,
  }));
  const serviceRoutes = services.map((s) => ({
    url: `${BASE}/services/${s.slug}`,
    lastModified: now,
  }));
  const questionnaireRoutes = Object.keys(QUESTIONNAIRES).map((slug) => ({
    url: `${BASE}/questionnaire/${slug}`,
    lastModified: now,
  }));
  return [
    ...staticRoutes,
    ...portfolioRoutes,
    ...serviceRoutes,
    ...questionnaireRoutes,
  ];
}
