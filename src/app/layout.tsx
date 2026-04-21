import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getSiteSettings } from "@/lib/content";

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
  "Julian Perez Photography — DMV-based wedding, engagement, graduation, portrait, family, maternity, headshot, concert, and event photographer serving Northern Virginia, Washington DC, and Maryland.";

// `generateMetadata` is async so Julian-edited values in Studio (site
// name, etc.) flow through without a redeploy. The keyword list,
// alternates, robots, and twitter fields stay constants since they're
// technical / SEO concerns rather than editorial content.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${settings.siteName} · DMV Wedding, Portrait & Event Photographer`,
      template: `%s · ${settings.siteName}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: settings.siteName,
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
      "corporate reception photographer DC",
      "social club reception photographer DC",
      "Hill reception photographer DC",
      "gala photographer Washington DC",
      "vow renewal photographer DMV",
      "anniversary photographer Northern Virginia",
      "concert photographer DC",
      "live music photographer DMV",
      "band photographer Washington DC",
      "recital photographer Northern Virginia",
      "stage performance photographer DC",
      "brand content photographer DMV",
      "real estate photographer Northern Virginia",
      "Airbnb listing photographer DC",
      "Julian Perez Photography",
    ],
    alternates: { canonical: SITE_URL },
    openGraph: {
      title: `${settings.siteName} · DMV Wedding, Portrait & Event Photographer`,
      description: DEFAULT_DESCRIPTION,
      url: SITE_URL,
      siteName: settings.siteName,
      locale: "en_US",
      type: "website",
      images: [
        {
          url: "/og.jpg",
          width: 1200,
          height: 630,
          alt: settings.siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${settings.siteName} · DMV Photographer`,
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
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  const ga4 = settings.analytics.ga4Id;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}#business`,
    name: settings.siteName,
    image: `${SITE_URL}/og.jpg`,
    url: SITE_URL,
    email: settings.contactEmail,
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
      settings.social.instagram,
      settings.social.facebook,
      settings.social.youtube,
    ].filter(Boolean),
    makesOffer: [
      "Wedding Photography",
      "Engagement & Couples Photography",
      "Maternity Photography",
      "Newborn & First Year Photography",
      "Family Portrait Photography",
      "Family Celebration & Party Photography",
      "Cultural Milestone Photography",
      "Pet Photography",
      "Personal Branding & Creative Portraiture",
      "Graduation Photography",
      "Corporate Headshots",
      "Corporate & Community Event Photography",
      "Concert & Live Performance Photography",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
