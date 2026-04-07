import Link from "next/link";
import type { Metadata } from "next";
import { siteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Book a Session",
  description: "Book a photography session via Square Appointments.",
};

export default function BookPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Book
      </div>
      <h1 className="mt-2 font-serif text-5xl">Book a session</h1>
      <p className="mt-4 text-[var(--muted)]">
        I use Square Appointments for booking. Click below to pick a time on my
        live calendar — deposits are collected through Square to confirm your
        date.
      </p>

      <div className="mt-10 p-6 border border-[var(--accent)] rounded-lg bg-white">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Payment preferences
        </div>
        <p className="mt-2 text-[var(--foreground)]">
          {siteSettings.paymentPreferences}
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Zelle and Venmo details are shared in the booking confirmation email.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={siteSettings.bookingUrl}
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
        >
          Open Square booking →
        </a>
        <Link
          href="/inquire"
          className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Not sure yet? Inquire first
        </Link>
      </div>

      <div className="mt-12 text-sm text-[var(--muted)]">
        Prefer to chat before booking?{" "}
        <a
          href={`mailto:${siteSettings.contactEmail}`}
          className="underline underline-offset-4"
        >
          Email me directly.
        </a>
      </div>
    </section>
  );
}
