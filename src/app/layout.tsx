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

export const metadata: Metadata = {
  metadataBase: new URL("https://julianperezphotography.com"),
  title: {
    default: `${siteSettings.siteName} · DMV Wedding & Portrait Photographer`,
    template: `%s · ${siteSettings.siteName}`,
  },
  description: siteSettings.tagline,
  openGraph: {
    title: siteSettings.siteName,
    description: siteSettings.tagline,
    url: "https://julianperezphotography.com",
    siteName: siteSettings.siteName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteSettings.siteName,
    description: siteSettings.tagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ga4 = siteSettings.analytics.ga4Id;
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
