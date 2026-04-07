import Link from "next/link";
import type { Metadata } from "next";
import { siteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteSettings.siteName} — Northeastern-trained engineer turned DMV wedding, portrait, and event photographer.`,
};

export default function AboutPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        About
      </div>
      <h1 className="mt-2 font-serif text-5xl">Hi, I&rsquo;m Julian.</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-[var(--foreground)]/90">
        <p>
          My name is Julian Perez and I&rsquo;m a 2021 graduate of Northeastern
          University, with a Computer Engineering degree and a Photography
          Minor. At the start of my photography adventure, I was entirely
          self-taught in regard to both photo-taking and post-processing
          techniques. My interest in photography slowly developed over several
          years from a novelty hobby out of boredom on my old iPhone 4 to a
          genuine passion using my Canon Rebel T3i and film cameras. I would
          mainly focus on travel photography and landscapes, and I always
          became the designated photographer for family events.
        </p>
        <p>
          With my upgrade to a more professional and reliable Sony mirrorless
          system as I took on more work, I have continued expanding my horizons
          and exploring the human connection as a photographer for weddings
          and engagements, events, portraits and headshots, and photojournalism.
          I&rsquo;ve also started delving into video work! As I continue to
          expand my capabilities, I have consistently challenged myself to
          change my mindset and use new tools to accomplish something unique
          for each project — something I feel is a crucial skill to be able to
          satisfy every client&rsquo;s unique needs while retaining the
          signature style I have developed over the years.
        </p>
        <p>
          For details about my services and pricing, please feel free to reach
          me using the contact page. I mainly work in the Arlington, VA /
          Washington, DC area but can travel as needed.
        </p>
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-8 text-sm text-[var(--muted)] space-y-2">
        <div>{siteSettings.coverageArea}</div>
        <div>{siteSettings.bookingStatus}</div>
        <div>
          <a
            href={`mailto:${siteSettings.contactEmail}`}
            className="underline underline-offset-4"
          >
            {siteSettings.contactEmail}
          </a>
        </div>
      </div>

      <div className="mt-10 flex gap-3 flex-wrap">
        <Link
          href="/inquire"
          className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
        >
          Start an inquiry
        </Link>
        <Link
          href="/portfolio"
          className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          See recent work
        </Link>
      </div>
    </section>
  );
}
