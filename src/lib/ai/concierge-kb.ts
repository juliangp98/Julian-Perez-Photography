// Builds the plain-text knowledge base the public concierge is grounded in.
//
// Composed entirely from PUBLIC catalog content — site settings, the visible
// service catalog (condensed), the shared FAQ set, and the about-page bio.
// It deliberately never touches the client/CRM store, so no private data can
// reach the model. React-cached so a burst of chat turns shares one build.

import { cache } from "react";
import { getSiteSettings, getVisibleServices, getAboutPage } from "./content";
import { getAllFaqs } from "./faq";
import { UMBRELLAS } from "./types";

const umbrellaTitle = Object.fromEntries(
  UMBRELLAS.map((u) => [u.id, u.title]),
) as Record<string, string>;

export const buildConciergeContext = cache(async (): Promise<string> => {
  const [settings, services, about, faqs] = await Promise.all([
    getSiteSettings(),
    getVisibleServices(),
    getAboutPage(),
    getAllFaqs(),
  ]);

  const lines: string[] = [];

  lines.push(`STUDIO: ${settings.siteName} — ${settings.tagline}`);
  lines.push(`COVERAGE AREA: ${settings.coverageArea}.`);
  lines.push(`CURRENT BOOKING STATUS: ${settings.bookingStatus}.`);
  lines.push(
    `HOW TO BOOK: send an inquiry at /inquire (with date + details); a discovery call can be booked at ${settings.calls.discoveryCall.url}; a deposit holds the date.`,
  );
  lines.push(`CONTACT EMAIL: ${settings.contactEmail}.`);
  lines.push(`PAYMENT: ${settings.paymentPreferences}`);
  lines.push(
    "PHOTO DELIVERY: final images arrive in a private online gallery (Pic-Time) with a print release; most galleries within a few weeks, with a sneak peek sooner on many sessions.",
  );
  if (about?.bio?.length) {
    lines.push(`ABOUT JULIAN: ${about.bio.join(" ")}`);
  }

  lines.push("");
  lines.push("SERVICES & PRICING (each has a page at /services/<slug>):");
  for (const s of services) {
    const packages =
      s.packages
        .map(
          (p) =>
            `${p.name} ${p.price}${p.duration ? ` (${p.duration})` : ""}`,
        )
        .join("; ") || "custom quote";
    const addOns = (s.addOns ?? [])
      .map((a) => `${a.name} ${a.price}`)
      .join("; ");
    let line = `- ${s.title} [${umbrellaTitle[s.umbrella] ?? s.umbrella}] (/services/${s.slug}): ${s.tagline} ${s.description} Packages: ${packages}.`;
    if (addOns) line += ` Add-ons: ${addOns}.`;
    if (s.pricingNote) line += ` ${s.pricingNote}`;
    lines.push(line);
  }

  lines.push("");
  lines.push("FREQUENTLY ASKED QUESTIONS:");
  for (const f of faqs) {
    lines.push(`Q: ${f.question}`);
    lines.push(`A: ${f.answer}`);
  }

  return lines.join("\n");
});
