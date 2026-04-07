export type ServiceSlug =
  | "weddings"
  | "engagements"
  | "graduation"
  | "portraiture"
  | "modeling"
  | "family"
  | "maternity"
  | "corporate-headshots"
  | "corporate-events"
  | "promotional";

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
  title: string;
  description: string;
  coverImage: string;
  images: { src: string; alt: string }[];
  hidden?: boolean;
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  contactEmail: string;
  coverageArea: string;
  bookingStatus: string;
  bookingUrl: string;
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
};
