// Builds the plain-text knowledge base the public concierge is grounded in.
//
// Composed entirely from PUBLIC catalog content — site settings, the visible
// service catalog (condensed), the shared FAQ set, and a short about-page bio.
// It deliberately never touches the client/CRM store, so no private data can
// reach the model. React-cached so a burst of chat turns shares one build.
//
// The context is kept under a character budget (`MAX_CONTEXT_CHARS`). Groq's
// free-tier models cap at 8k tokens/minute, and the concierge request is
// system prompt + transcript + reserved completion; an unbounded KB (every
// service description + every FAQ answer in full) overran that. Core facts
// (booking, contact, condensed services) are always included; FAQs fill the
// remaining budget and the tail is dropped — the concierge already defers
// ("not certain → /inquire") for anything not in context, so that's safe. Set
// AI_MODEL to a higher-tier model / provider (or upgrade Groq) to raise the
// ceiling and carry a fuller KB.

import { cache } from "react";
import { getSiteSettings, getVisibleServices, getAboutPage } from "@/lib/content";
import { getAllFaqs } from "@/lib/faq";
import { UMBRELLAS } from "@/lib/types";

const umbrellaTitle = Object.fromEntries(
  UMBRELLAS.map((u) => [u.id, u.title]),
) as Record<string, string>;

// ~4.5k tokens, leaving room for the transcript + reserved completion under
// the 8k/minute free-tier ceiling.
const MAX_CONTEXT_CHARS = 18_000;

export const buildConciergeContext = cache(async (): Promise<string> => {
  const [settings, services, about, faqs] = await Promise.all([
    getSiteSettings(),
    getVisibleServices(),
    getAboutPage(),
    getAllFaqs(),
  ]);

  // Core facts — always included.
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
    // A brief intro, not the full bio — the concierge books sessions; it
    // rarely needs the whole life story, and it's the cheapest thing to trim.
    const bio = about.bio.join(" ");
    lines.push(
      `ABOUT JULIAN: ${bio.length > 400 ? `${bio.slice(0, 400).trimEnd()}…` : bio}`,
    );
  }

  lines.push("");
  lines.push("SERVICES & PRICING (each has a page at /services/<slug>):");
  for (const s of services) {
    const packages =
      s.packages
        .map(
          (p) => `${p.name} ${p.price}${p.duration ? ` (${p.duration})` : ""}`,
        )
        .join("; ") || "custom quote";
    const addOns = (s.addOns ?? [])
      .map((a) => `${a.name} ${a.price}`)
      .join("; ");
    // Condensed: tagline + packages carry the bookable facts. The long
    // marketing `description` is dropped to fit the token budget — the
    // service's own page has it, and the concierge points there.
    let line = `- ${s.title} [${umbrellaTitle[s.umbrella] ?? s.umbrella}] (/services/${s.slug}): ${s.tagline} Packages: ${packages}.`;
    if (addOns) line += ` Add-ons: ${addOns}.`;
    if (s.pricingNote) line += ` ${s.pricingNote}`;
    lines.push(line);
  }

  // FAQs fill the remaining budget; drop the tail once it's reached.
  lines.push("");
  lines.push("FREQUENTLY ASKED QUESTIONS:");
  let used = lines.join("\n").length;
  for (const f of faqs) {
    const entry = `Q: ${f.question}\nA: ${f.answer}`;
    if (used + entry.length + 1 > MAX_CONTEXT_CHARS) break;
    lines.push(entry);
    used += entry.length + 1;
  }

  return lines.join("\n");
});
