import type { NextConfig } from "next";

// Permanent redirects from old service / portfolio slugs to the post-restructure
// slugs. Keeps any existing inbound links and indexed search results from 404ing.
const SLUG_REDIRECTS: { from: string; to: string }[] = [
  { from: "engagements", to: "engagements-couples" },
  { from: "family", to: "family-portraits" },
  { from: "promotional", to: "brand-commercial" },
  { from: "corporate-events", to: "corporate-community-events" },
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
// + Speed Insights + Blob storage), Google (Analytics + Places review
// avatars), Square Appointments (the `/book` iframe), and Pic-Time
// (the `/client` gallery iframe).
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.vercel-insights.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.sanity.io https://lh3.googleusercontent.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sanity.io https://www.google-analytics.com https://*.vercel-insights.com https://*.vercel-scripts.com https://*.blob.vercel-storage.com",
  "frame-src 'self' https://*.squareup.com https://*.pic-time.com",
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
  // inline-image assets flow through that host. Without this,
  // <Image src="https://cdn.sanity.io/..."> would throw at runtime
  // with "hostname not configured".
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/**" },
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

export default nextConfig;
