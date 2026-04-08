import type { Metadata } from "next";
import { siteSettings } from "@/lib/content";
import GoogleReviews from "@/components/GoogleReviews";

export const metadata: Metadata = {
  title: "Client Galleries",
  description:
    "Access your Pic-Time client gallery to view, download, and order prints.",
  robots: { index: false, follow: false },
};

export default async function ClientGalleriesPage() {
  const url = siteSettings.clientGalleryUrl;
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Clients
      </div>
      <h1 className="mt-2 font-serif text-5xl">Your gallery</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        I deliver all client galleries through Pic-Time. Sign in with the link
        I sent you to view, favorite, download, and order prints. If you
        can&rsquo;t find your invite,{" "}
        <a
          href={`mailto:${siteSettings.contactEmail}`}
          className="underline underline-offset-4"
        >
          email me
        </a>{" "}
        and I&rsquo;ll resend it.
      </p>

      <div className="mt-10">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
        >
          Open Pic-Time →
        </a>
      </div>

      {/* Embedded Pic-Time portal. Pic-Time sets X-Frame-Options on some
          pages, so we give the iframe a reasonable height and fall back to
          the link above if the embed can't render. */}
      <div className="mt-12 rounded-lg overflow-hidden border border-[var(--border)] bg-white">
        <iframe
          src={url}
          title="Pic-Time client galleries"
          className="w-full h-[80vh] min-h-[600px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Embed not loading? Use the &ldquo;Open Pic-Time&rdquo; button above —
        some browsers block cross-site iframes by default.
      </p>

      <div className="mt-20 pt-12 border-t border-[var(--border)]">
        <GoogleReviews
          heading="What past clients have said"
          variant="carousel"
        />
      </div>
    </section>
  );
}
