import type { NextConfig } from "next";

// Permanent redirects from old service / portfolio slugs to the post-restructure
// slugs. Keeps any existing inbound links and indexed search results from 404ing.
const SLUG_REDIRECTS: { from: string; to: string }[] = [
  { from: "engagements", to: "engagements-couples" },
  { from: "family", to: "family-portraits" },
  { from: "promotional", to: "brand-commercial" },
  { from: "corporate-events", to: "corporate-community-events" },
];

const nextConfig: NextConfig = {
  // Emit a minimal standalone server so the Docker image stays small.
  // Safe to keep enabled for Vercel deployments too — Vercel ignores it.
  output: "standalone",
  async redirects() {
    return SLUG_REDIRECTS.flatMap(({ from, to }) => [
      {
        source: `/services/${from}`,
        destination: `/services/${to}`,
        permanent: true,
      },
      {
        source: `/portfolio/${from}`,
        destination: `/portfolio/${to}`,
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
