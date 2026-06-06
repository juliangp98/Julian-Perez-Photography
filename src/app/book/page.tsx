import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/content";
import CalloutCard from "@/components/CalloutCard";
import Button from "@/components/Button";

export const metadata: Metadata = {
  title: "Book a Session",
  description: "Book a photography session via Square Appointments.",
};

export default async function BookPage() {
  const settings = await getSiteSettings();
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Book
      </div>
      <h1 className="mt-2 font-serif text-5xl">Book a session</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        Pick a service and a time below — my Square calendar is live, so what
        you see is real availability. A small deposit holds the date.
      </p>

      {/* Two-column info row: payment preferences + what to expect.
          Stacks on mobile. Sits above the embed so people see the
          context before they reach the calendar. */}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="p-6 border border-[var(--accent)] rounded-lg bg-white">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Payment preferences
          </div>
          <p className="mt-2 text-[var(--foreground)]">
            {settings.paymentPreferences}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Zelle and Venmo details are shared in the booking confirmation
            email.
          </p>
        </div>
        <div className="p-6 border border-[var(--border)] rounded-lg bg-white">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            What to expect
          </div>
          <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
            <li>
              <strong>1.</strong> Choose a service and time on the calendar
              below.
            </li>
            <li>
              <strong>2.</strong> Square collects a deposit to confirm your
              date.
            </li>
            <li>
              <strong>3.</strong> I&rsquo;ll follow up within 24 hours with a
              short questionnaire and next steps.
            </li>
          </ul>
        </div>
      </div>

      {/* Embedded Square Appointments calendar. Square doesn't set
          X-Frame-Options or a CSP frame-ancestors directive on the
          public booking page, so framing is allowed. We give it a tall
          min-height because the Square layout is scroll-heavy and a
          short iframe forces double scrollbars.

          We previously tried a sandbox attribute to keep service-detail
          clicks inside the embed, but Square's app silently no-ops
          inside a sandboxed frame (it detects the restricted context
          and refuses to navigate at all). The "Open in new tab" button
          below + the note about it are the supported fallback for
          users who'd rather complete booking on squareup.com directly. */}
      <div className="mt-12 rounded-lg overflow-hidden border border-[var(--border)] bg-white">
        <iframe
          src={settings.bookingUrl}
          title="Square Appointments — book a session"
          className="w-full h-[85vh] min-h-[800px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-[var(--muted)]">
          Embed not loading? Use the &ldquo;Open in new tab&rdquo; button —
          some browsers block cross-site iframes by default.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={settings.bookingUrl} external>
            Open in new tab →
          </Button>
          <Button href="/inquire" variant="secondary">
            Not sure yet? Inquire first
          </Button>
        </div>
      </div>

      <div className="mt-10 text-sm text-[var(--muted)]">
        Prefer to chat before booking?{" "}
        <a
          href={`mailto:${settings.contactEmail}`}
          className="underline underline-offset-4"
        >
          Email me directly.
        </a>
      </div>

      <div className="mt-8 max-w-3xl">
        <CalloutCard
          eyebrow="Already booked or seriously considering?"
          title="Plan your session"
          description="Start your service-specific planning questionnaire so I can show up with everything I need on the day. It autosaves in your browser, so you can fill it out in pieces."
          actions={[{ label: "Plan your session →", href: "/questionnaire" }]}
        />
      </div>
    </section>
  );
}
