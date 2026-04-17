"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaInstagram, FaFacebook, FaYoutube } from "react-icons/fa6";
import { siteSettings } from "@/lib/content";

export default function Footer() {
  const pathname = usePathname();
  // Mirror Nav.tsx — Studio owns its viewport. Skip the footer too so Studio's
  // own bottom chrome (status bar, etc.) isn't shoved below ours. Cheap to
  // be a client component; the footer is static links, no RSC benefit lost.
  if (pathname?.startsWith("/studio")) return null;

  const year = new Date().getFullYear();
  const socialIconClass =
    "w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-[var(--foreground)] transition";
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-serif text-2xl">{siteSettings.siteName}</div>
          <p className="mt-3 text-sm text-[var(--muted)] max-w-sm">
            {siteSettings.tagline}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {siteSettings.coverageArea}
          </p>
          <p className="mt-3 text-sm">
            <a
              href={`mailto:${siteSettings.contactEmail}`}
              className="underline underline-offset-4"
            >
              {siteSettings.contactEmail}
            </a>
          </p>
          <div className="mt-5 flex gap-3">
            {siteSettings.social.instagram && (
              <a
                href={siteSettings.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className={socialIconClass}
              >
                <FaInstagram size={16} />
              </a>
            )}
            {siteSettings.social.facebook && (
              <a
                href={siteSettings.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className={socialIconClass}
              >
                <FaFacebook size={16} />
              </a>
            )}
            {siteSettings.social.youtube && (
              <a
                href={siteSettings.social.youtube}
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
                href={siteSettings.clientGalleryUrl}
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
            © {year} {siteSettings.siteName}. All rights reserved.
          </div>
          <div>{siteSettings.bookingStatus}</div>
        </div>
      </div>
    </footer>
  );
}
