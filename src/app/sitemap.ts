import type { MetadataRoute } from "next";
import { getVisiblePortfolios, getVisibleServices } from "@/lib/content";
import { QUESTIONNAIRES } from "@/lib/questionnaires";
import { SITE_URL } from "@/lib/site-settings-data";

// Services and portfolios both come from Sanity at request time (60s
// revalidate). The two fetches run in parallel under React's `cache()`
// so the sitemap build pays one round-trip, not two.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    "",
    "/portfolio",
    "/services",
    "/about",
    "/faq",
    "/inquire",
    "/book",
    "/questionnaire",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
  }));
  const [portfolios, services] = await Promise.all([
    getVisiblePortfolios(),
    getVisibleServices(),
  ]);
  const portfolioRoutes = portfolios.map((p) => ({
    url: `${SITE_URL}/portfolio/${p.slug}`,
    lastModified: now,
  }));
  const serviceRoutes = services.map((s) => ({
    url: `${SITE_URL}/services/${s.slug}`,
    lastModified: now,
  }));
  const questionnaireRoutes = Object.keys(QUESTIONNAIRES).map((slug) => ({
    url: `${SITE_URL}/questionnaire/${slug}`,
    lastModified: now,
  }));
  return [
    ...staticRoutes,
    ...portfolioRoutes,
    ...serviceRoutes,
    ...questionnaireRoutes,
  ];
}
