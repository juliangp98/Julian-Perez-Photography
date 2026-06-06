import type { Metadata } from "next";
import InquiryForm from "@/components/InquiryForm";
import GoogleReviews from "@/components/GoogleReviews";
import { getSiteSettings } from "@/lib/content";
import CalloutCard from "@/components/CalloutCard";
import SubNav, { FUNNEL_TABS } from "@/components/SubNav";

export const metadata: Metadata = {
  title: "Inquire",
  description: "Tell me about your event and I'll get back to you within 48 hours.",
};

export default async function InquirePage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    project?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSiteSettings()]);
  return (
    <section className="max-w-5xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={FUNNEL_TABS} />
      <h1 className="mt-6 font-serif text-5xl">Let&rsquo;s talk.</h1>
      <p className="mt-4 text-[var(--muted)] max-w-xl">
        This form is for general inquiries — questions about availability,
        pricing, custom packages, or anything you want to chat through before
        booking. I&rsquo;ll reply within 48 hours. Prefer email? Reach me
        directly at{" "}
        <a
          href={`mailto:${settings.contactEmail}`}
          className="underline underline-offset-4"
        >
          {settings.contactEmail}
        </a>
        .
      </p>
      <div className="mt-10 max-w-3xl">
        <CalloutCard
          eyebrow="Already booked or seriously considering?"
          title="Skip the back-and-forth"
          description="Start your service-specific planning questionnaire instead. It autosaves in your browser and gives me everything I need to show up prepared."
          actions={[
            { label: "Browse planning questionnaires →", href: "/questionnaire" },
          ]}
        />
      </div>
      <div className="mt-12 max-w-3xl">
        <InquiryForm
          defaultService={sp.service}
          discoveryCall={settings.calls.discoveryCall}
          projectId={sp.project}
          defaultName={sp.fullName}
          defaultEmail={sp.email}
          defaultPhone={sp.phone}
        />
      </div>
      <div className="mt-20 pt-12 border-t border-[var(--border)]">
        <GoogleReviews heading="What clients say" variant="carousel" />
      </div>
    </section>
  );
}
