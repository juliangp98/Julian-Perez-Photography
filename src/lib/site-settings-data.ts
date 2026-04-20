// Pure-data module: exports the hard-coded `siteSettingsFallback` object
// with zero runtime imports (just types). This isolation matters because
// the seed script (`scripts/seed-sanity.ts`) imports from here under tsx
// without pulling React, Next, or the Sanity client into scope — all of
// which `src/lib/content.ts` transitively pulls in via `getSiteSettings`.
//
// Everyday call sites keep importing `siteSettingsFallback` from
// `@/lib/content` (it re-exports from here); only the seed script reaches
// into this file directly.

import type { SiteSettings } from "./types";

export const siteSettingsFallback: SiteSettings = {
  siteName: "Julian Perez Photography",
  tagline: "Timeless moments from your best days, captured.",
  contactEmail: "juliangperez98@gmail.com",
  coverageArea: "Based in NOVA · Serving the DMV",
  bookingStatus: "Booking 2026\u20132027",
  bookingUrl:
    "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services",
  calls: {
    discoveryCall: {
      label: "Book a discovery call",
      url: "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services/2LKF3PGSFGBI6Y2AY4DJQMT6",
    },
    planningCall: {
      label: "Book a planning call",
      url: "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services/U4N4NWOKZ5W5EFBL6VLNBV3N",
    },
    weddingTimelineCall: {
      label: "Book a wedding timeline call",
      url: "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services/PZ5HV4XYSEIJ3CZJURRRBUZ4",
    },
    venueWalkthrough: {
      label: "Book a venue walkthrough",
      url: "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services/JMDAYYTC2GCUD4OLQHDBHESX",
    },
  },
  clientGalleryUrl: "https://julianperezphotography.pic-time.com/client",
  paymentPreferences:
    "Deposits via Square. Balances preferred via Zelle, Venmo, or cash.",
  social: {
    instagram: "https://instagram.com/julianperezphotography",
    facebook: "https://facebook.com/julianperezphotography",
    youtube: "https://youtube.com/@JulianPerezPhotography",
  },
  analytics: {
    ga4Id: "G-PHCBCZ85RW",
  },
  // Public link to the Google Business Profile so the testimonials section
  // can include a "see all reviews on Google" attribution. Update if the
  // share link changes.
  googleProfileUrl: "https://share.google/EXrXPk1nuF0ilODwV",
  // Manually curated testimonials sourced from Julian's Google Business
  // Profile dashboard. Used as the fallback when the Google Places API
  // can't reach the business (service-area profiles without published
  // address). Reviews are pasted verbatim with consent.
  testimonials: [
    {
      author: "Josh Drake",
      rating: 5,
      relativeTime: "3 days ago",
      text: "My wife & I hired Julian to photograph our wedding last June. He was very responsive, easy to work with, & helpful throughout the planning process. He made himself available for several planning calls, guided us through creating our shot list, & even gave us some tips on posing ahead of our wedding day. On our special day, Julian was busy ensuring he captured all of the specific shots we wanted. He later provided us with a curated selection of around 1,100 photos to choose from. Again, he was very accommodating in the review & editing process. We are truly thrilled with the finished product and our photos look absolutely stunning! Thank you, Julian, for a wonderful experience!",
    },
    {
      author: "Jahnavi Patel",
      rating: 5,
      relativeTime: "6 months ago",
      text: "Julian Perez did an amazing job with both my maternity and baby shower photography! He captured every special moment beautifully and made me feel so comfortable throughout the sessions. The photos came out stunning \u2014 natural, warm, and exactly what I had envisioned. Highly recommend him to anyone looking for a talented and professional photographer who truly cares about his work!",
    },
    {
      author: "Devin Perez",
      rating: 5,
      relativeTime: "Sep 10, 2024",
      text: "I've had the pleasure of working with Julian as a photographer for several important events (law school graduation, law school barrister's ball, elopement, and wedding) and I cannot recommend him enough. He captures all of the special small candid moments in addition to being a great help when posing for more formal portraits. His editing style is beautiful, golden, and natural, bringing out the best in each person captured and the environment. I've recommended him multiple times to friends for their weddings and graduation portraits and they've all been so incredibly happy with the results.",
    },
    {
      author: "Stephani Sotomayor Yzaguirre",
      rating: 5,
      relativeTime: "10 months ago",
      text: "I'm amazed by Julian's work. It was a pleasure to work with him on such an important day as my graduation. He made me and my family feel really comfortable and the photographs were amazing, a memory I'll always treasure.",
    },
    {
      author: "Wesley Schaire",
      rating: 5,
      relativeTime: "11 months ago",
      text: "Julian was an absolute pleasure to work with! He was very professional and prepared! He perfectly captured our special day while working around last-minute changes to the schedule.",
    },
    {
      author: "Dr. Simona Efanov",
      rating: 5,
      relativeTime: "Nov 26, 2023",
      text: "We worked with Julian for family photos shoot and I can't stress enough what a fantastic job he did! Not only he was kind, patient and extremely professional, but the communication with him prior, during and post project was outstanding! He captured priceless moments, was patient with us, and he understood exactly what I was looking for. The quality of the pictures are also outstanding; I personally like bright colors and natural lighting, rather than faded or b&w effects and the pictures we got represent our experience living in the area and the bright and natural look I was looking for. Thank you Julian!",
    },
    {
      author: "Sukti Dhital",
      rating: 5,
      relativeTime: "Jan 2, 2024",
      text: "Julian was the BEST! We hired him to cover our parents' 50th wedding anniversary celebration and the pictures are fantastic. Julian was timely, respectful, very open to capturing both portraits and action photographs, and a true joy to work with.",
    },
    {
      author: "Ayumi Gintautas",
      rating: 5,
      relativeTime: "Sep 24, 2023",
      text: "Julian is a great photographer!! If you are looking for a photographer, I would highly recommend him. We found him on Facebook. It was a blessing in disguise. Very high quality photos for a very reasonable price! We are very satisfied :)",
    },
  ],
};
