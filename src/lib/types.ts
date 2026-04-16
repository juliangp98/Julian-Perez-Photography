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

export type PortfolioSlug = ServiceSlug;

export type Package = {
  name: string;
  tagline?: string;
  price: string;
  priceNote?: string;
  duration?: string;
  inclusions: string[];
  featured?: boolean;
  group?: string; // Optional sub-section label (e.g. "Solo" vs "Group" for graduation).
};

export type AddOn = {
  name: string;
  price: string;
  description?: string;
};

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
  hidden?: boolean; // If true, excluded from nav/listings/sitemap/static params.
};

export type PortfolioCategory = {
  slug: PortfolioSlug;
  umbrella: Umbrella;
  title: string;
  description: string;
  coverImage: string;
  images: { src: string; alt: string }[];
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
