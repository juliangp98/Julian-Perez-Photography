import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/content";
import GoogleReviews from "@/components/GoogleReviews";
import SubNav, { CLIENT_TABS } from "@/components/SubNav";
import CalloutCard from "@/components/CalloutCard";

export const metadata: Metadata = {
  title: "Client Galleries",
  description:
    "Access your Pic-Time client gallery to view, download, and order prints.",
  robots: { index: false, follow: false },
};

export default async function ClientGalleriesPage() {
  const settings = await getSiteSettings();
  const url = settings.clientGalleryUrl;
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={CLIENT_TABS} />
      <h1 className="mt-8 font-serif text-5xl">Your gallery</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        I deliver all client galleries through Pic-Time. Sign in with the link
        I sent you to view, favorite, download, and order prints. If you
        can&rsquo;t find your invite,{" "}
        <a
          href={`mailto:${settings.contactEmail}`}
          className="underline underline-offset-4"
        >
          email me
        </a>{" "}
        and I&rsquo;ll resend it.
      </p>

      <div className="mt-10 max-w-2xl">
        <CalloutCard
          eyebrow="Access your photos"
          title="Galleries & project portal"
          description="Open Pic-Time to view and download your gallery. Or sign in to your project portal to track your booking, review key dates and locations, and find your documents — same email you used with me, no password needed."
          actions={[
            { label: "Open Pic-Time →", href: url, external: true },
            {
              label: "Sign in to your portal →",
              href: "/portal",
              variant: "secondary",
            },
          ]}
        />
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
