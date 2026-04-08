import type { Metadata } from "next";
import InquiryForm from "@/components/InquiryForm";
import GoogleReviews from "@/components/GoogleReviews";
import { siteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Inquire",
  description: "Tell me about your event and I'll get back to you within 48 hours.",
};

export default async function InquirePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const sp = await searchParams;
  return (
    <section className="max-w-5xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Inquire
      </div>
      <h1 className="mt-2 font-serif text-5xl">Let&rsquo;s talk.</h1>
      <p className="mt-4 text-[var(--muted)] max-w-xl">
        Fill out the form below and I&rsquo;ll reply within 48 hours. Prefer
        email? Reach me directly at{" "}
        <a
          href={`mailto:${siteSettings.contactEmail}`}
          className="underline underline-offset-4"
        >
          {siteSettings.contactEmail}
        </a>
        .
      </p>
      <div className="mt-12 max-w-3xl">
        <InquiryForm defaultService={sp.service} />
      </div>
      <div className="mt-20 pt-12 border-t border-[var(--border)]">
        <GoogleReviews heading="What clients say" variant="carousel" />
      </div>
    </section>
  );
}
