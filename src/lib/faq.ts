// Unified FAQ model — the single source shared by the public /faq directory
// and the concierge chat's grounding context, so the two can never drift.
//
// Two kinds of entry are merged: a curated set of site-wide ("general")
// questions owned here in code, and the per-service questions that already
// live on each `serviceCategory.faqs[]` (Sanity-backed, rendered on the
// service pages). Service entries inherit their service's umbrella + identity
// so the directory can map and filter them by collection.

import { cache } from "react";
import { getVisibleServices } from "./content";
import type { Umbrella, ServiceSlug } from "./types";

export type FaqScope = "general" | "service";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  scope: FaqScope;
  // Present on service-derived entries; absent on general ones (which group
  // under their own "General" bucket).
  umbrella?: Umbrella;
  serviceSlug?: ServiceSlug;
  serviceTitle?: string;
};

// Site-wide questions that aren't tied to one service. Written in Julian's
// first-person voice to match the service FAQs, and kept evergreen — no
// hardcoded prices or booking years (those live on the service pages and in
// site settings, which the concierge context pulls live) so this set doesn't
// drift. A Studio-editable equivalent on site settings is a future option.
export const GENERAL_FAQS: FaqItem[] = [
  {
    id: "general-areas",
    scope: "general",
    question: "What areas do you serve, and do you travel?",
    answer:
      "I'm based in Northern Virginia and cover the entire DMV — DC, Maryland, and Virginia — at no extra travel charge. For weddings and sessions further out, I'm glad to travel; just reach out and I'll put together a custom quote that includes travel.",
  },
  {
    id: "general-booking",
    scope: "general",
    question: "How do I book a session or wedding?",
    answer:
      "Start by sending an inquiry through the contact form with your date and what you have in mind. I'll get back to you, we can hop on a quick discovery call if you'd like, and a deposit holds your date on the calendar. That's it — you're booked.",
  },
  {
    id: "general-availability",
    scope: "general",
    question: "Are you available for my date?",
    answer:
      "Quite possibly — popular dates do book ahead, so the surest way to know is to send your date through the inquiry form. I'll confirm availability and walk you through the next steps.",
  },
  {
    id: "general-payment",
    scope: "general",
    question: "How do deposits and payments work?",
    answer:
      "A deposit secures your date and is handled through Square. The remaining balance can be paid by Zelle, Venmo, or cash and is typically due around the time of your session or event — I'll lay out the exact schedule when we book.",
  },
  {
    id: "general-delivery",
    scope: "general",
    question: "How and when will I get my photos?",
    answer:
      "Your final images arrive in a private online gallery with a print release, so you can download, share, and print them however you like. Most galleries are ready within a few weeks, and many sessions include a quick sneak peek sooner.",
  },
  {
    id: "general-prints",
    scope: "general",
    question: "Do you offer prints and albums?",
    answer:
      "Yes. Several packages include prints, and you can add a print package or a premium album as an add-on. Every gallery also comes with a print release, so you're free to print on your own too.",
  },
  {
    id: "general-combine",
    scope: "general",
    question: "Can I combine more than one type of session?",
    answer:
      "Absolutely — some of my favorite work pairs naturally, like an engagement session with a wedding, or maternity with a newborn session. Tell me what you're picturing in your inquiry and I'll suggest the right combination.",
  },
  {
    id: "general-style",
    scope: "general",
    question: "What's your photography style?",
    answer:
      "Natural, warm, and candid — I focus on real moments and the way a place actually feels, with editing that's bright and timeless rather than heavily filtered. I'll guide you on posing when you want it, and otherwise let the day unfold.",
  },
];

// Every FAQ across the site — general first, then each visible service's
// questions tagged with that service's umbrella + identity. React-cached so
// the /faq page and the concierge context share one resolution per request.
export const getAllFaqs = cache(async (): Promise<FaqItem[]> => {
  const services = await getVisibleServices();
  const serviceFaqs: FaqItem[] = [];
  for (const s of services) {
    (s.faqs ?? []).forEach((faq, i) => {
      serviceFaqs.push({
        id: `${s.slug}-${i}`,
        question: faq.question,
        answer: faq.answer,
        scope: "service",
        umbrella: s.umbrella,
        serviceSlug: s.slug,
        serviceTitle: s.title,
      });
    });
  }
  return [...GENERAL_FAQS, ...serviceFaqs];
});
