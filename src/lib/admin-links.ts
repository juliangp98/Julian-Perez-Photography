// What the admin Links page lists: the links Julian shares with clients (from
// site settings and each service's sample gallery), the tools he works in,
// and the services the site runs on with whether each is set up. Pure, so the
// page and the specs build the same lists.

import { unsetSettings } from "./config";
import { PAYMENT_METHODS, paymentMethodLabel } from "./labels";
import { listOf } from "./email/send-effects";
import type { ServiceCategory, SiteSettings } from "./types";

type Env = Record<string, string | undefined>;

// A web address to link to: only http(s), so a mistyped or unsafe value from
// Studio (no scheme, javascript:) is never put in an href.
export function webAddress(value?: string | null): string | undefined {
  const v = value?.trim();
  return v && /^https?:\/\/\S+$/i.test(v) ? v : undefined;
}

// One thing to copy: a link (with its address as `href`) or a line of text.
export type ShareLink = { label: string; value: string; href?: string };
// A group of them, with the ones Studio has no value for named in `missing`.
export type ShareGroup = { title: string; note: string; links: ShareLink[]; missing: string[] };

// The Square booking calls, with the name each goes by when Studio's label
// is blank.
const CALLS = [
  ["discoveryCall", "Discovery call"],
  ["planningCall", "Planning call"],
  ["weddingTimelineCall", "Wedding timeline call"],
  ["venueWalkthrough", "Venue walkthrough"],
] as const;

function linkGroup(title: string, note: string, items: { label: string; url?: string | null }[]): ShareGroup {
  const links: ShareLink[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const href = webAddress(item.url);
    if (href) links.push({ label: item.label, value: href, href });
    else missing.push(item.label);
  }
  return { title, note, links, missing };
}

// The links and lines Julian sends clients. A sample gallery is listed for a
// service shown on the site only, since a hidden one isn't offered.
export function sharedLinks(
  settings: Pick<SiteSettings, "calls" | "googleProfileUrl" | "clientGalleryUrl" | "paymentInstructions">,
  services: Pick<ServiceCategory, "title" | "sampleGalleryUrl" | "hidden">[],
): ShareGroup[] {
  const pay: ShareGroup = {
    title: "How to pay",
    note: "What a client sees in their portal for the payment method on their project.",
    links: [],
    missing: [],
  };
  for (const m of PAYMENT_METHODS) {
    const line = settings.paymentInstructions?.[m.value]?.trim();
    const label = paymentMethodLabel(m.value);
    if (line) pay.links.push({ label, value: line });
    else pay.missing.push(label);
  }
  return [
    linkGroup(
      "Booking calls",
      "The Square booking links. A client picks a time from these.",
      CALLS.map(([key, name]) => {
        const call = settings.calls?.[key];
        return { label: call?.label?.trim() || name, url: call?.url };
      }),
    ),
    linkGroup("Reviews", "Where a happy client leaves a review.", [
      { label: "Google review link", url: settings.googleProfileUrl },
    ]),
    linkGroup("Client galleries", "Where clients sign in to see their galleries.", [
      { label: "Pic-Time client login", url: settings.clientGalleryUrl },
    ]),
    linkGroup(
      "Sample galleries",
      "A full gallery per service, to send with a proposal.",
      services.filter((s) => !s.hidden).map((s) => ({ label: s.title, url: s.sampleGalleryUrl })),
    ),
    pay,
  ];
}

// "Not set in Studio yet: A, B and C." for a group's missing items.
export function notSetLine(missing: string[]): string {
  return missing.length ? `Not set in Studio yet: ${listOf(missing)}.` : "";
}

// A dashboard or tool, with the settings that say whether the site is set up
// to use it (none when that can't be told from a setting).
export type ServiceLink = {
  label: string;
  href: string;
  desc: string;
  internal?: boolean;
  settings?: readonly string[];
};

// The tools Julian works in day to day.
export const TOOLS: ServiceLink[] = [
  {
    label: "Square dashboard",
    href: "https://squareup.com/dashboard",
    desc: "Contracts, invoices, payments and the booking calls.",
  },
  { label: "Pic-Time", href: "https://www.pic-time.com", desc: "Client galleries and deliveries." },
  {
    label: "Gmail",
    href: "https://mail.google.com",
    desc: "The studio inbox. Mail to the studio address forwards here.",
  },
];

// The services the site runs on, by area. A link's settings are names from
// src/lib/config.ts.
export const SITE_SERVICES: { title: string; links: ServiceLink[] }[] = [
  {
    title: "Hosting",
    links: [
      {
        label: "Vercel dashboard",
        href: "https://vercel.com/dashboard",
        desc: "Deployments, environment variables, Blob storage, the daily cron, domains, logs and the firewall.",
        settings: ["BLOB_READ_WRITE_TOKEN", "CRON_SECRET"],
      },
    ],
  },
  {
    title: "Site content (Sanity)",
    links: [
      {
        label: "Sanity Manage",
        href: "https://www.sanity.io/manage",
        desc: "Project settings, API tokens, datasets, members and the publish webhook.",
        settings: ["NEXT_PUBLIC_SANITY_PROJECT_ID"],
      },
      {
        label: "Sanity Studio",
        href: "/studio",
        desc: "Edit journal posts, services, portfolios, site settings and the About page.",
        internal: true,
        settings: ["NEXT_PUBLIC_SANITY_PROJECT_ID"],
      },
    ],
  },
  {
    title: "Client data (Supabase)",
    links: [
      {
        label: "Supabase dashboard",
        href: "https://supabase.com/dashboard",
        desc: "The client store: table editor, SQL editor and API keys.",
        settings: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      },
    ],
  },
  {
    title: "Email and texts",
    links: [
      {
        label: "Resend",
        href: "https://resend.com/overview",
        desc: "Every email the site sends: domains, API keys and delivery activity, and the receiving domain and webhook that put replies on each project's thread.",
        settings: ["RESEND_API_KEY", "RESEND_INBOUND_DOMAIN", "RESEND_WEBHOOK_SECRET"],
      },
      {
        label: "Twilio console",
        href: "https://console.twilio.com",
        desc: "Text confirmations: phone numbers, usage and the auth token.",
        settings: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_FROM"],
      },
    ],
  },
  {
    title: "AI",
    links: [
      {
        label: "Groq console",
        href: "https://console.groq.com",
        desc: "API keys and usage for every AI feature. Its API doesn't train on what it receives.",
        settings: ["GROQ_API_KEY"],
      },
    ],
  },
  {
    title: "Google APIs",
    links: [
      {
        label: "Google Cloud Console",
        href: "https://console.cloud.google.com",
        desc: "The Places API key, its limits, billing and daily quota.",
        settings: ["GOOGLE_PLACES_API_KEY"],
      },
    ],
  },
  {
    title: "Monitoring and code",
    links: [
      // The error reporting address is built in, so there's no setting to check.
      { label: "Sentry", href: "https://sentry.io", desc: "Errors, performance and session replay." },
      {
        label: "GitHub repository",
        href: "https://github.com/juliangp98/Julian-Perez-Photography",
        desc: "Source, branches, pull requests, Actions and secrets.",
      },
    ],
  },
  {
    title: "Search and security",
    links: [
      {
        label: "Google Search Console",
        href: "https://search.google.com/search-console",
        desc: "Indexing, the sitemap and how the site does in search.",
      },
      {
        label: "Rich Results Test",
        href: "https://search.google.com/test/rich-results",
        desc: "Checks the structured data the pages carry for search.",
      },
      {
        label: "HSTS Preload",
        href: "https://hstspreload.org",
        desc: "Where to submit the domain once HTTPS-only has run for 30 days.",
      },
    ],
  },
];

// The site services with the settings each is missing (empty when set up, or
// when it has no settings to check).
export function siteServices(env: Env = process.env) {
  return SITE_SERVICES.map((g) => ({
    ...g,
    links: g.links.map((l) => ({ ...l, missing: unsetSettings(l.settings ?? [], env) })),
  }));
}
