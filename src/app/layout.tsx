import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { siteSettings } from "@/lib/content";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://julianperezphotography.com";
const DEFAULT_DESCRIPTION =
  "Julian Perez Photography — DMV-based wedding, engagement, graduation, portrait, family, maternity, headshot, and event photographer serving Northern Virginia, Washington DC, and Maryland.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${siteSettings.siteName} · DMV Wedding, Portrait & Event Photographer`,
    template: `%s · ${siteSettings.siteName}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: siteSettings.siteName,
  authors: [{ name: "Julian Perez" }],
  creator: "Julian Perez",
  publisher: "Julian Perez Photography",
  keywords: [
    "DMV wedding photographer",
    "Northern Virginia wedding photographer",
    "DC wedding photographer",
    "Maryland wedding photographer",
    "Arlington photographer",
    "engagement photographer DMV",
    "couples photographer DC",
    "graduation photographer DC",
    "National Mall graduation photos",
    "family photographer Northern Virginia",
    "maternity photographer DMV",
    "newborn photographer Arlington",
    "pet photographer DMV",
    "quinceanera photographer Northern Virginia",
    "Sweet 16 photographer DC",
    "corporate headshots Arlington",
    "corporate event photographer DC",
    "brand content photographer DMV",
    "real estate photographer Northern Virginia",
    "Airbnb listing photographer DC",
    "Julian Perez Photography",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${siteSettings.siteName} · DMV Wedding, Portrait & Event Photographer`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: siteSettings.siteName,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: siteSettings.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteSettings.siteName} · DMV Photographer`,
    description: DEFAULT_DESCRIPTION,
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "Photography",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ga4 = siteSettings.analytics.ga4Id;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}#business`,
    name: siteSettings.siteName,
    image: `${SITE_URL}/og.jpg`,
    url: SITE_URL,
    email: siteSettings.contactEmail,
    description: DEFAULT_DESCRIPTION,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressRegion: "VA",
      addressCountry: "US",
      addressLocality: "Arlington",
    },
    areaServed: [
      { "@type": "City", name: "Arlington" },
      { "@type": "City", name: "Washington" },
      { "@type": "AdministrativeArea", name: "Northern Virginia" },
      { "@type": "AdministrativeArea", name: "Maryland" },
      { "@type": "AdministrativeArea", name: "Washington, DC" },
    ],
    sameAs: [
      siteSettings.social.instagram,
      siteSettings.social.facebook,
      siteSettings.social.youtube,
    ].filter(Boolean),
    makesOffer: [
      "Wedding Photography",
      "Engagement & Couples Photography",
      "Maternity Photography",
      "Newborn & First Year Photography",
      "Family Portrait Photography",
      "Family Celebration & Party Photography",
      "Pet Photography",
      "Quinceañera & Cultural Milestone Photography",
      "Personal Branding & Creative Portraiture",
      "Graduation Photography",
      "Corporate Headshots",
      "Corporate & Community Event Photography",
      "Brand & Commercial Content Photography",
      "Real Estate & Airbnb Listing Photography",
    ].map((name) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name },
    })),
  };
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="ld-localbusiness"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
        {ga4 && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
