import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server so the Docker image stays small.
  // Safe to keep enabled for Vercel deployments too — Vercel ignores it.
  output: "standalone",
};

export default nextConfig;
