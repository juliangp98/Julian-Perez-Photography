import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Permanent redirects from old service / portfolio slugs to the post-restructure
// slugs. Keeps any existing inbound links and indexed search results from 404ing.
const SLUG_REDIRECTS: { from: string; to: string }[] = [
  { from: "engagements", to: "engagements-couples" },
  { from: "family", to: "family-portraits" },
  { from: "promotional", to: "brand-commercial" },
  { from: "corporate-events", to: "corporate-community-events" },
  { from: "wedding-video", to: "wedding-films" },
];

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
//
// Site-wide hardening applied to every response. The set aligns with the
// OWSAP Secure Headers baseline:
//
//   - Strict-Transport-Security pins browsers to HTTPS for two years and
//     covers subdomains; `preload` marks the site as eligible for the
//     HSTS preload list once Julian submits it to hstspreload.org.
//   - X-Content-Type-Options stops browsers from MIME-sniffing a response
//     into an unexpected type (defence against polyglot attacks).
//   - X-Frame-Options + CSP `frame-ancestors` together block clickjacking
//     attempts that would embed the site inside another origin's iframe.
//   - Referrer-Policy prevents full URLs (which may contain inquiry
//     details) from leaking in the Referer header to third parties.
//   - Permissions-Policy denies powerful browser APIs the site never
//     uses, shrinking the surface any third-party script can request.
//
// The Content-Security-Policy ships in Report-Only mode first. Inline
// scripts still in use (GA4 bootstrap, JSON-LD structured data) would
// block under a strict enforcing policy without a hash/nonce pipeline;
// Report-Only surfaces violations in the browser console without
// breaking page rendering, which gives a safe soak window before the
// policy is promoted to enforcing mode.
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// Content-Security-Policy directives. The allowlists mirror the third-
// party origins actually in use: Sanity (CMS + CDN), Vercel (Analytics
// + Speed Insights + Blob storage, including blob-hosted wedding
// videos), Google (Analytics + Places review avatars), Square
// Appointments (the `/book` iframe), Pic-Time (the `/client` gallery
// iframe), YouTube (wedding-films portfolio embeds + thumbnails served
// from i.ytimg.com), and Sentry (error reporting — primary path is the
// same-origin `/monitoring/sentry` tunnel, but direct ingest hosts are
// allowlisted as a fallback for cases where the tunnel route is
// unavailable).
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.vercel-insights.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.sanity.io https://lh3.googleusercontent.com https://*.googleusercontent.com https://i.ytimg.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sanity.io https://www.google-analytics.com https://*.vercel-insights.com https://*.vercel-scripts.com https://*.blob.vercel-storage.com https://*.sentry.io https://*.ingest.sentry.io",
  // `media-src` governs <audio>/<video> sources. Blob-hosted wedding
  // films play through Vercel Blob; without this directive, default-src
  // 'self' blocks the cross-origin URL.
  "media-src 'self' https://*.blob.vercel-storage.com",
  "frame-src 'self' https://*.squareup.com https://*.pic-time.com https://www.youtube-nocookie.com https://www.youtube.com",
  // Sentry's SDK uses Web Workers for some replay / profiling paths —
  // allow `blob:` workers so the SDK runs without violations.
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Emit a minimal standalone server so the Docker image stays small.
  // Safe to keep enabled for Vercel deployments too — Vercel ignores it.
  output: "standalone",
  // Whitelist hostnames that next/image is allowed to optimize.
  // `cdn.sanity.io` is required for the journal — all coverImage +
  // inline-image assets flow through that host. `i.ytimg.com` covers
  // the auto-fetched YouTube thumbnails on the wedding-films portfolio
  // for entries that don't supply a manual `/public` thumbnail. Without
  // these, <Image src="..."> would throw at runtime with "hostname not
  // configured".
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
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
  async headers() {
    return [
      // Everything outside `/studio` gets the full set, including CSP.
      {
        source: "/((?!studio).*)",
        headers: [
          ...SECURITY_HEADERS,
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
        ],
      },
      // Sanity Studio injects its own scripts and styles dynamically and
      // does not play nicely with a restrictive CSP. It still gets the
      // baseline security headers, but the content-security-policy is
      // omitted so the embedded editor loads without surprises.
      {
        source: "/studio/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// Wrap with Sentry's build-time integration so errors thrown by API
// routes / server components / client components flow into the
// project's Sentry org. The wrapper is a no-op at runtime when the
// DSN is unset (see sentry.{client,server,edge}.config.ts); the
// build-time source-map upload is gated separately on
// `SENTRY_AUTH_TOKEN` being present, so local builds without that
// token skip the upload step cleanly.
export default withSentryConfig(nextConfig, {
  // Build-time logging — silenced for clean CI output. Flip to false
  // when debugging Sentry integration issues.
  silent: true,
  // Org + project are set from env so this file doesn't carry
  // identity. Both come from the Sentry dashboard.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token is build-time only — never lives in Vercel's runtime
  // env. Source maps upload only when this is present, which means
  // local + preview builds without the token still succeed; only the
  // production CI step ships symbolicated stack traces.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    // Remove source maps from the build output after they're uploaded
    // to Sentry. Defends against the bundle leak that public source
    // maps would otherwise create.
    deleteSourcemapsAfterUpload: true,
  },
  // Widen the set of client files included in the source-map upload so
  // dynamically-imported chunks + middleware bundles get symbolicated
  // too. Without it the bundler plugin defaults to a narrower file set
  // that misses some App Router output.
  widenClientFileUpload: true,
  // Tunnel Sentry traffic through a Next.js route so ad-blockers
  // don't drop client-side error reports. Picks an obscure path so
  // the tunnel itself isn't a crawl target.
  tunnelRoute: "/monitoring/sentry",
});
