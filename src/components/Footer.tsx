"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaInstagram, FaFacebook, FaYoutube } from "react-icons/fa6";
import { siteSettingsFallback } from "@/lib/content";

// Footer stays a client component because of the `usePathname()` gate
// below. That means it can't `await getSiteSettings()` — we read from
// `siteSettingsFallback` directly instead. Every field used here
// (siteName, tagline, coverageArea, contactEmail, social.*,
// clientGalleryUrl, bookingStatus) either changes rarely (siteName,
// social URLs, gallery portal) or rolls forward with the seed source
// (bookingStatus → "Booking YYYY-YYYY" updates annually via code + seed).
// Moving the /studio pathname gate to the root layout would let this
// become a server component, but it'd also couple root-layout rendering
// to a routing prop that nothing else uses — not worth it for fields
// that basically never change at runtime.
export default function Footer() {
  const pathname = usePathname();
  // Mirror Nav.tsx — Studio owns its viewport. Skip the footer too so Studio's
  // own bottom chrome (status bar, etc.) isn't shoved below ours.
  if (pathname?.startsWith("/studio")) return null;

  const year = new Date().getFullYear();
  const socialIconClass =
    "w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-[var(--foreground)] transition";
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-serif text-2xl">{siteSettingsFallback.siteName}</div>
          <p className="mt-3 text-sm text-[var(--muted)] max-w-sm">
            {siteSettingsFallback.tagline}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {siteSettingsFallback.coverageArea}
          </p>
          <p className="mt-3 text-sm">
            <a
              href={`mailto:${siteSettingsFallback.contactEmail}`}
              className="underline underline-offset-4"
            >
              {siteSettingsFallback.contactEmail}
            </a>
          </p>
          <div className="mt-5 flex gap-3">
            {siteSettingsFallback.social.instagram && (
              <a
                href={siteSettingsFallback.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className={socialIconClass}
              >
                <FaInstagram size={16} />
              </a>
            )}
            {siteSettingsFallback.social.facebook && (
              <a
                href={siteSettingsFallback.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className={socialIconClass}
              >
                <FaFacebook size={16} />
              </a>
            )}
            {siteSettingsFallback.social.youtube && (
              <a
                href={siteSettingsFallback.social.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className={socialIconClass}
              >
                <FaYoutube size={16} />
              </a>
            )}
          </div>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">Explore</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li>
              <Link href="/portfolio" className="hover:text-[var(--foreground)]">
                Portfolio
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-[var(--foreground)]">
                Services &amp; Pricing
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[var(--foreground)]">
                About
              </Link>
            </li>
            <li>
              <Link href="/journal" className="hover:text-[var(--foreground)]">
                Journal
              </Link>
            </li>
            <li>
              <Link href="/inquire" className="hover:text-[var(--foreground)]">
                Inquire
              </Link>
            </li>
            <li>
              <Link href="/book" className="hover:text-[var(--foreground)]">
                Book
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">For clients</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li>
              <Link href="/client" className="hover:text-[var(--foreground)]">
                Client galleries
              </Link>
            </li>
            <li>
              <Link
                href="/questionnaire"
                className="hover:text-[var(--foreground)]"
              >
                Plan your session
              </Link>
            </li>
            <li>
              <a
                href={siteSettingsFallback.clientGalleryUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--foreground)]"
              >
                Pic-Time portal ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 text-xs text-[var(--muted)] flex flex-col md:flex-row gap-3 justify-between">
          <div>
            © {year} {siteSettingsFallback.siteName}. All rights reserved.
          </div>
          <div>{siteSettingsFallback.bookingStatus}</div>
        </div>
      </div>
    </footer>
  );
}
