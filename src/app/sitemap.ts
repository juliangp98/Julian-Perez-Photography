import type { MetadataRoute } from "next";
import {
  visibleServices as services,
  visiblePortfolios as portfolios,
} from "@/lib/content";
import { QUESTIONNAIRES } from "@/lib/questionnaires";

const BASE = "https://julianperezphotography.com";

export default function sitemap(): MetadataRoute.Sitemap {
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
