// Top-level umbrella categories that group related services in the nav and on
// the index pages. Order matters — this is the order they render in.
export type Umbrella =
  | "weddings-couples"
  | "family-life"
  | "portraits-pro"
  | "brand-events";

export const UMBRELLAS: { id: Umbrella; title: string; tagline: string }[] = [
  {
    id: "weddings-couples",
    title: "Weddings & Couples",
    tagline: "Your story, from the yes to the I do.",
  },
  {
    id: "family-life",
    title: "Family & Life Events",
    tagline: "The people, milestones, and gatherings that make your story.",
  },
  {
    id: "portraits-pro",
    title: "Personal & Pro Portraits",
    tagline: "Portraits that look like you on a really good day.",
  },
  {
    id: "brand-events",
    title: "Brand & Events",
    tagline: "Photography for businesses, properties, and live events.",
  },
];

export type ServiceSlug =
  | "weddings"
  | "wedding-video"
  | "engagements-couples"
  | "graduation"
  | "portraiture"
  | "modeling"
  | "newborn"
  | "family-portraits"
  | "family-celebrations"
  | "cultural-milestones"
  | "pet"
  | "maternity"
  | "corporate-headshots"
  | "corporate-community-events"
  | "concerts-performances"
  | "brand-commercial"
  | "real-estate";

// Portfolio slugs are mostly 1:1 with service slugs (every photo service has
// a parallel gallery), but the wedding-films portfolio is its own category
// — the underlying service is `wedding-video`. New portfolio-only slugs
// extend this union without requiring a matching service entry.
export type PortfolioSlug = ServiceSlug | "wedding-films";

export type Package = {
  name: string;
  tagline?: string;
  price: string;
  priceNote?: string;
  duration?: string;
  inclusions: string[];
  featured?: boolean;
  group?: string; // Optional sub-section label (e.g. "Solo" vs "Group" for graduation).
  // Crew configuration string for service categories where the shooter
  // count is part of the offer — currently used by wedding-video tiers
  // ("Julian + 1 partner videographer") and rendered as a small caption
  // under the package name. Other service categories leave this unset.
  crewSize?: string;
  // A short disclosure paragraph rendered beneath the inclusions list,
  // visually distinct from the bullet list. Used to name a tradeoff that
  // the tier's price reflects (e.g. the gear-switch coverage gap on the
  // wedding-video Solo Hybrid tier). Optional everywhere; only populated
  // where transparency about a tradeoff is part of the offering.
  honestyNote?: string;
};

export type AddOn = {
  name: string;
  price: string;
  description?: string;
};

export type FAQ = { question: string; answer: string };

export type ServiceCategory = {
  slug: ServiceSlug;
  umbrella: Umbrella;
  title: string;
  tagline: string;
  description: string;
  intro?: string[]; // Longer-form philosophy paragraphs shown above the packages.
  comboNote?: string; // Upsell note (e.g. wedding + engagement combo language).
  heroImage?: string;
  packages: Package[];
  addOns?: AddOn[];
  pricingNote?: string;
  faqs?: FAQ[]; // Rendered as FAQPage JSON-LD for Google rich results.
  hidden?: boolean; // If true, excluded from nav/listings/sitemap/static params.
};

export type PortfolioImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
};

// Discriminated source for a single portfolio video. YouTube entries embed
// via iframe and can pull thumbnails automatically from i.ytimg.com; blob
// entries play through an HTML5 <video> tag against a Vercel Blob URL and
// require a manual thumbnail in /public.
export type VideoSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "blob"; url: string };

export type VideoEntry = {
  id: string; // slug-safe identifier; used as the React key + URL anchor
  title: string;
  date?: string; // ISO date "YYYY-MM-DD"; powers the natural-fill sort
  venue?: string;
  description?: string;
  source: VideoSource;
  // /public path to a manually-exported thumbnail. For YouTube entries
  // this can be omitted — the renderer falls back to
  // https://i.ytimg.com/vi/<videoId>/maxresdefault.jpg.
  thumbnail?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  thumbnailBlurDataURL?: string;
  durationSeconds?: number; // optional — rendered as M:SS overlay on the tile
  featured?: boolean; // pin to the hero tile; most-recent-by-date wins ties
  hidden?: boolean;
  order?: number; // manual ordering in Studio; lower shows first
};

export type PortfolioCategory = {
  slug: PortfolioSlug;
  umbrella: Umbrella;
  title: string;
  description: string;
  coverImage: string;
  images: PortfolioImage[];
  // Optional video archive. Photo galleries leave this unset; the
  // wedding-films portfolio populates it. The page renderer branches on
  // whether `videos` is non-empty.
  videos?: VideoEntry[];
  // Optional override for the "View pricing" cross-link on the detail
  // page. Defaults to `slug` when unset, which works for the photo
  // galleries that share a slug with their service. The wedding-films
  // portfolio sets this to "wedding-video" so the link points at the
  // matching service page.
  serviceSlug?: ServiceSlug;
  hidden?: boolean;
};

// A single client testimonial. Used as the manual fallback for the
// GoogleReviews component when the Google Places API can't reach the
// business (e.g. service-area profiles without a published address).
// Reviews are sourced directly from the Google Business Profile dashboard
// and pasted in here verbatim with consent.
export type Testimonial = {
  author: string;
  rating: number; // 1–5
  relativeTime: string; // free-form, e.g. "a month ago" or "2024"
  text: string;
  source?: string; // defaults to "Google"
};

// /about page content — singleton doc in Sanity.
// Fields track the editable surface of src/app/about/page.tsx:
//   - `heading`: top headline, e.g. "Hi, I'm Julian."
//   - `bio`: array of plain-text paragraphs (not Portable Text — the
//     copy is 3 plain paragraphs).
//   - `headshot`: optional path to a /public image (Lightroom workflow).
//     Not rendered yet; reserved for the feature landing.
// Cross-page info (coverage area, booking status, contact email) lives
// on `SiteSettings` below — not duplicated here.
export type AboutPage = {
  heading: string;
  bio: string[];
  headshot?: string;
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  contactEmail: string;
  coverageArea: string;
  bookingStatus: string;
  bookingUrl: string;
  calls: {
    discoveryCall: { label: string; url: string };
    planningCall: { label: string; url: string };
    weddingTimelineCall: { label: string; url: string };
    venueWalkthrough: { label: string; url: string };
  };
  clientGalleryUrl: string; // Pic-Time client delivery portal.
  paymentPreferences: string;
  social: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  analytics: {
    ga4Id?: string;
  };
  testimonials: Testimonial[];
  googleProfileUrl?: string; // public link to the GBP for "see all reviews"
};
