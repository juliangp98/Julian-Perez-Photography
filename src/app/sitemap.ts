import type { MetadataRoute } from "next";
import {
  visibleServices as services,
  visiblePortfolios as portfolios,
} from "@/lib/content";

const BASE = "https://julianperezphotography.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/portfolio", "/services", "/about", "/inquire", "/book"].map(
    (path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
    }),
  );
  const portfolioRoutes = portfolios.map((p) => ({
    url: `${BASE}/portfolio/${p.slug}`,
    lastModified: now,
  }));
  const serviceRoutes = services.map((s) => ({
    url: `${BASE}/services/${s.slug}`,
    lastModified: now,
  }));
  return [...staticRoutes, ...portfolioRoutes, ...serviceRoutes];
}
