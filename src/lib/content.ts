import type {
  PortfolioCategory,
  ServiceCategory,
  SiteSettings,
} from "./types";

// Site-wide settings. Edit here (or migrate to Sanity later).
export const siteSettings: SiteSettings = {
  siteName: "Julian Perez Photography",
  tagline: "Timeless moments from your best days, captured.",
  contactEmail: "juliangperez98@gmail.com",
  coverageArea: "Based in NOVA · Serving the DMV",
  bookingStatus: "Booking 2026–2027",
  bookingUrl:
    "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services",
  // Pic-Time client delivery portal — where booked clients view/download their galleries.
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
};

// Service categories with pricing. Wedding, engagement, and graduation copy
// comes directly from julianperezphoto.com; remaining six categories are
// seeded with fair pricing derived from those existing tiers.
//
// Conventions:
//   - `description` is the short subtitle under the page title (same format
//     across every service page, muted color).
//   - `intro` is the long-form body copy. For weddings/engagements/graduation,
//     these paragraphs are Julian's original language; the final paragraph is
//     a short segue that leads into the packages grid.
//   - Packages are ordered most expensive → least expensive.
export const services: ServiceCategory[] = [
  {
    slug: "weddings",
    title: "Weddings",
    tagline: "Your whole day, told honestly.",
    description:
      "Full wedding-day coverage across the DMV, built around your story.",
    intro: [
      "Your wedding day is more than just a ceremony; it's a tapestry of genuine moments, from the quiet anticipation before the \u201CI do\u201D to the joyous energy of the dance floor.",
      "I believe in a relaxed, artful approach to wedding photography. While I'll provide gentle direction for beautiful portraits and family photos, my main focus is on the authentic emotions and unscripted interactions that make your day uniquely yours.",
      "My goal is to be both a friend and an observant eye, blending into the background to capture those fleeting, heartfelt moments you'll want to relive forever.",
      "Ultimately, your job is to be fully present and celebrate. My job is to handle the rest, guiding you through the process with calm confidence and a stress-free attitude.",
      "I'll be there to document your journey from the engagement session to the big day and beyond, ensuring every memory is beautifully preserved.",
      "Every package below includes a private online gallery, full print release, and a 72-hour sneak peek so you can start sharing before the last dance.",
    ],
    comboNote:
      "Packages are detailed below, but I also offer custom solutions tailored to your unique needs. For Wedding Packages that include an Engagement Session, see the Engagements page for session details. Let's create some magic together.",
    packages: [
      {
        name: "Platinum",
        tagline: "The top choice for an all-in-one experience",
        price: "$3,600",
        duration: "Full day (prep → sendoff)",
        inclusions: [
          "500+ edited photos",
          "Second shooter included",
          "Wedding photo album included",
          "Premium engagement session included",
          "Film photography included",
          "25-photo sneak peek within 72 hours",
        ],
      },
      {
        name: "Premium",
        tagline: "Unforgettable details and moments, start to finish",
        price: "$3,200",
        duration: "Full day (prep → sendoff)",
        featured: true,
        inclusions: [
          "500+ edited photos",
          "Second shooter included",
          "Album or engagement session (your choice)",
          "20-photo sneak peek within 72 hours",
        ],
      },
      {
        name: "Silver",
        tagline: "More time, more coverage, more you",
        price: "$2,800",
        duration: "Full day + formal group portraits",
        inclusions: [
          "400+ edited photos",
          "Second shooter included",
          "Standard engagement session included",
          "15-photo sneak peek within 72 hours",
        ],
      },
      {
        name: "Essentials",
        tagline: "The go-to for essential wedding coverage",
        price: "$2,400",
        duration: "Prep, ceremony, key reception events",
        inclusions: [
          "300+ edited photos",
          "Optional second photographer add-on",
          "10-photo sneak peek within 72 hours",
        ],
      },
      {
        name: "Mini",
        tagline: "Give your elopement or civil ceremony the full treatment",
        price: "$800",
        duration: "Ceremony + portraits + newlywed shots",
        inclusions: ["100+ edited photos", "Solo photographer"],
      },
    ],
    addOns: [
      { name: "Additional hour of coverage", price: "$300" },
      { name: "Second shooter (Essentials only)", price: "$400" },
      { name: "Rehearsal dinner coverage (2 hours)", price: "$400" },
      { name: "Film photography (when not included)", price: "$200" },
      { name: "Rush gallery delivery (2 weeks)", price: "$250" },
      { name: "Premium linen wedding album", price: "$350" },
    ],
    pricingNote:
      "Traveling outside the DMV? Reach out — custom quotes available for destination and multi-day weddings.",
  },
  {
    slug: "engagements",
    title: "Engagements",
    tagline: "A relaxed session to celebrate the yes.",
    description:
      "Relaxed sessions across the DMV — included with most wedding packages.",
    intro: [
      "The engagement session is where we get to know each other before the big day. It's a low-pressure afternoon that doubles as a rehearsal: you practice being photographed, I learn your rhythm as a couple, and we both show up to the wedding already on the same page.",
      "Come as yourselves. Dress the way you'd actually want to be remembered — put-together or barefoot in a field, either works. The best sessions happen when it doesn't feel like a shoot at all.",
      "Whether you're warming up for the wedding or celebrating a fresh yes, pick the pace below that fits your story.",
    ],
    comboNote:
      "Booking a wedding? Engagement sessions are included with the Silver, Premium, and Platinum wedding packages.",
    packages: [
      {
        name: "Premium",
        tagline: "A full afternoon with room to breathe",
        price: "$400",
        duration: "2 hours",
        featured: true,
        inclusions: [
          "50+ edited photos",
          "Multiple outfits and locations",
          "Prints included",
        ],
      },
      {
        name: "Surprise Proposal",
        tagline: "I'll be hiding in the bushes — happy to coordinate",
        price: "$350",
        duration: "1 hour",
        inclusions: [
          "40+ edited photos",
          "Discreet coverage of the moment itself",
          "Portrait session right after the yes",
          "Prints included",
        ],
      },
      {
        name: "Essentials",
        tagline: "One location, one look, zero fuss",
        price: "$300",
        duration: "45 minutes",
        inclusions: ["30+ edited photos", "One location"],
      },
    ],
    addOns: [
      { name: "Extra hour of coverage", price: "$150" },
      { name: "Additional location (within 10 mi)", price: "$50" },
      { name: "Rush gallery delivery (48 hours)", price: "$75" },
      { name: "Film roll add-on", price: "$100" },
      { name: "Print package (5 × 8×10)", price: "$85" },
    ],
  },
  {
    slug: "graduation",
    title: "Graduation",
    tagline: "Caps off to everything you earned.",
    description:
      "Solo, group, and family grad sessions across the DMV — permit handling included.",
    intro: [
      "Your graduation marks a once-in-a-lifetime milestone — cap, gown, proud smiles, and all the people who helped you get here.",
      "My goal is to capture every bit of that excitement in vibrant, timeless portraits. I handle the planning, posing, and permits (as needed) so you can celebrate stress-free.",
      "Solo, squad, or full-family — pick the version of graduation day you're celebrating below, with permit handling for the National Mall and monuments available whenever you need it.",
    ],
    packages: [
      {
        name: "Signature Graduate",
        group: "Solo",
        tagline:
          "A full-featured session that lets us capture both the classic cap-and-gown shots and your individual style",
        price: "$350",
        duration: "60 minutes",
        featured: true,
        inclusions: [
          "1–2 locations",
          "25+ edited photos",
          "2 outfits",
          "Permit assistance",
          "Online gallery with download + print rights",
          "72-hour sneak peek",
          "2-week turnaround",
        ],
      },
      {
        name: "Mini Cap & Gown",
        group: "Solo",
        tagline: "Quick cap & gown portraits for grads on a budget",
        price: "$225",
        duration: "30 minutes",
        inclusions: [
          "1 location",
          "15+ edited photos",
          "1 outfit",
          "Online gallery with download + print rights",
          "1-week turnaround",
        ],
      },
      {
        name: "Study Group Session",
        group: "Group",
        tagline:
          "Document the squad that survived your late-night study sessions (or karaoke nights)",
        price: "$360",
        priceNote: "Base (2 graduates) · +$60 per additional graduate",
        duration: "90 minutes",
        inclusions: [
          "1–2 nearby locations",
          "50+ edited photos",
          "5+ portraits per graduate",
          "Group shots",
          "Shared gallery with download + print rights",
          "72-hour sneak peek",
        ],
      },
      {
        name: "Family Graduation Session",
        group: "Group",
        tagline:
          "Celebrate together with portraits that blend cap-and-gown pride and candid family joy",
        price: "$325",
        priceNote: "Base (4 people) · +$25 per additional family member",
        duration: "60 minutes",
        inclusions: [
          "1 location",
          "30+ edited photos",
          "Solo and family combinations",
          "Posed and candid moments",
        ],
      },
    ],
    addOns: [
      {
        name: "National Mall / Monument permit handling",
        price: "$150",
      },
      { name: "Rush gallery delivery (48 hours)", price: "$75" },
      { name: "Additional location (within 5 mi)", price: "$50" },
      { name: "Extra hour of coverage", price: "$150" },
    ],
    pricingNote:
      "Questions or unique ideas? I'm all ears — use the inquiry form or email me directly to start planning your perfect graduation session.",
  },
  {
    slug: "portraiture",
    title: "Portraiture",
    tagline: "Portraits that actually look like you.",
    description:
      "Individual sessions for creatives, professionals, and personal branding.",
    intro: [
      "A good portrait isn't about a perfect pose — it's about looking like yourself on a really good day. I lean on guided direction and natural conversation to make the session feel like hanging out, not a performance.",
      "Sessions work for personal branding, creative portfolios, anniversary gifts, artist headshots, or just because you deserve a set of photos you actually love. Studio or outdoors, I'll help you plan wardrobe, location, and pacing before we shoot.",
      "Pick the tier below that matches how much room you want to explore — every package includes a full print release.",
    ],
    packages: [
      {
        name: "Premium",
        tagline: "A full creative session for brand, editorial, or portfolio work",
        price: "$625",
        duration: "90 minutes",
        inclusions: [
          "Unlimited outfit changes",
          "Multiple locations",
          "60+ edited photos",
          "Prints included",
          "Wardrobe + location planning call",
          "Online gallery with print release",
        ],
      },
      {
        name: "Signature",
        tagline: "The standard portrait experience with room to explore",
        price: "$425",
        duration: "60 minutes",
        featured: true,
        inclusions: [
          "2 outfits",
          "1–2 locations",
          "40+ edited photos",
          "72-hour sneak peek",
          "Online gallery with print release",
        ],
      },
      {
        name: "Essentials",
        tagline: "A clean, efficient session for one look and one location",
        price: "$275",
        duration: "30 minutes",
        inclusions: [
          "1 outfit",
          "1 location",
          "20+ edited photos",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Extra 30 minutes of coverage", price: "$100" },
      { name: "Additional outfit", price: "$50" },
      { name: "Additional location (within 5 mi)", price: "$50" },
      { name: "Rush gallery delivery (48 hours)", price: "$75" },
      { name: "Print package (5 × 8×10)", price: "$85" },
      { name: "Studio rental", price: "$100" },
    ],
  },
  {
    slug: "modeling",
    title: "Modeling",
    hidden: true,
    tagline: "Test shoots, digitals, and portfolio-builders.",
    description:
      "Digitals, test shoots, and editorial work for working and aspiring models.",
    intro: [
      "Whether you're building your first book, updating digitals for your agency, or developing a creative concept for tear sheets, I love collaborating with models and creative teams to make something that actually stands out.",
      "I'm happy to help coordinate hair, makeup, and styling referrals in the DMV — or work with your existing team. Every session starts with a quick concept call so we show up on the same page.",
      "From fast-turnaround digitals to full editorial stories, the tiers below cover the full range — scroll down to find the one that matches where your book is headed.",
    ],
    packages: [
      {
        name: "Editorial",
        tagline: "Build a concept-driven story from scratch",
        price: "$850",
        duration: "3–4 hours",
        inclusions: [
          "4+ looks across multiple locations",
          "Concept + mood-board development",
          "50+ edited images",
          "Tear-sheet quality retouching on selects",
          "HMUA referrals available",
        ],
      },
      {
        name: "Test Shoot",
        tagline: "A focused session to add polished work to your book",
        price: "$500",
        duration: "2 hours",
        featured: true,
        inclusions: [
          "2–3 looks",
          "Concept consult beforehand",
          "30+ edited portfolio images",
          "Print + web-ready exports",
          "Online gallery with usage rights",
        ],
      },
      {
        name: "Digitals",
        tagline: "Clean, unretouched polaroids for agency submissions",
        price: "$250",
        duration: "45 minutes",
        inclusions: [
          "Simple, neutral backgrounds",
          "Full-length, 3/4, and headshot frames",
          "15+ unretouched digitals",
          "24-hour turnaround",
        ],
      },
    ],
    addOns: [
      { name: "Rush digital delivery (4 hours)", price: "$75" },
      { name: "Additional look", price: "$150" },
      { name: "Advanced retouching (per image)", price: "$35" },
      { name: "HMUA coordination fee", price: "$100" },
      { name: "Studio rental", price: "$150" },
    ],
    pricingNote:
      "Agencies and creative teams — reach out for multi-model day rates and recurring test-shoot programs.",
  },
  {
    slug: "family",
    title: "Family Events",
    tagline: "The people who make home feel like home.",
    description:
      "Birthdays, reunions, and milestones — documented with the same care as a wedding.",
    intro: [
      "Family sessions are part documentary, part orchestrated. I'll help organize the big group shots everyone will want printed, and then step back so the kids can be kids and the grown-ups can actually enjoy themselves.",
      "Whether it's a backyard birthday, a reunion at a rental house, or a milestone you've been waiting years to celebrate together — I treat every family event like a mini wedding. Full coverage, gentle direction, and a gallery you'll want to share with everyone who was there.",
      "Pick the length of coverage below that fits the gathering — from quick portrait sessions to full day-of documentary.",
    ],
    packages: [
      {
        name: "Milestone",
        tagline: "The full day — for groups you rarely get in one place",
        price: "$950",
        duration: "4 hours",
        inclusions: [
          "Any group size",
          "Multiple locations",
          "100+ edited photos",
          "Extended candid + posed coverage",
          "Sneak peek within 72 hours",
          "Online gallery with download + print rights",
        ],
      },
      {
        name: "Celebration",
        tagline: "Full event coverage for birthdays, reunions, and parties",
        price: "$650",
        duration: "3 hours",
        featured: true,
        inclusions: [
          "Up to 20 people",
          "Full event documentation",
          "60+ edited photos",
          "Sneak peek within 72 hours",
          "Online gallery with download + print rights",
        ],
      },
      {
        name: "Gathering",
        tagline: "Shorter sessions for intimate family moments",
        price: "$450",
        duration: "2 hours",
        inclusions: [
          "Up to 10 people",
          "1–2 locations",
          "40+ edited photos",
          "Posed group shots + candids",
          "Online gallery with download + print rights",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour of coverage", price: "$200" },
      { name: "Additional location (within 10 mi)", price: "$75" },
      { name: "Rush gallery delivery (72 hours)", price: "$100" },
      { name: "Print package (10 × 8×10)", price: "$120" },
    ],
  },
  {
    slug: "maternity",
    title: "Maternity",
    tagline: "Soft, patient, and yours to keep.",
    description:
      "Outdoor or studio maternity sessions planned around your comfort.",
    intro: [
      "Maternity sessions should feel peaceful, not performative. I plan around how you're actually feeling that week: comfortable locations, relaxed pacing, and as many breaks as you need. Partner and sibling shots are always included at no extra cost.",
      "I can help with wardrobe ideas, sourcing flowy dresses, and scouting locations with shade and easy access. The goal is photos that look like a quiet love letter to the three, four, or five of you.",
      "The tiers below range from a gentle portrait session to a full styled experience — choose whichever matches how much of the story you want told.",
    ],
    packages: [
      {
        name: "Premium",
        tagline: "Studio plus outdoor, with full styling support",
        price: "$725",
        duration: "2 hours",
        inclusions: [
          "Studio + outdoor locations",
          "Unlimited outfit changes",
          "60+ edited photos",
          "Wardrobe + styling consult",
          "Partner and sibling shots included",
          "Prints included",
        ],
      },
      {
        name: "Signature",
        tagline: "The standard experience with room to tell a full story",
        price: "$525",
        duration: "90 minutes",
        featured: true,
        inclusions: [
          "1–2 locations",
          "2 outfits",
          "40+ edited photos",
          "Partner and sibling shots included",
          "Sneak peek within 72 hours",
          "Online gallery with print release",
        ],
      },
      {
        name: "Essentials",
        tagline: "A gentle, focused session in one location",
        price: "$350",
        duration: "45 minutes",
        inclusions: [
          "1 location",
          "1 outfit",
          "25+ edited photos",
          "Partner included",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Extra 30 minutes of coverage", price: "$100" },
      { name: "Additional location (within 10 mi)", price: "$50" },
      { name: "Print package (5 × 8×10)", price: "$100" },
      { name: "Rush gallery delivery (72 hours)", price: "$75" },
      { name: "Newborn follow-up mini (within 4 weeks)", price: "$200" },
    ],
  },
  {
    slug: "corporate-headshots",
    title: "Corporate Headshots",
    tagline: "Professional, polished, and actually flattering.",
    description:
      "On-location or studio headshots for teams and individuals across the DMV.",
    intro: [
      "Corporate headshots don't have to look corporate. I light every subject carefully, coach posture and expression in real time, and deliver images that are LinkedIn-ready without looking like a template.",
      "For teams, I match lighting, framing, and background across every person so your About page looks cohesive — no more mismatched crops from five different photographers over the years.",
      "Whether it's one person or a full office, there's a tier below that fits — from quick solo sessions to full on-site half-days.",
    ],
    packages: [
      {
        name: "On-site Half-Day",
        tagline: "I bring the studio to your office",
        price: "$1,200",
        duration: "4 hours",
        inclusions: [
          "Up to 20 headshots",
          "Full mobile lighting kit + backdrop",
          "2 retouched images per person",
          "Consistent style across the team",
        ],
      },
      {
        name: "Team Bundle",
        tagline: "Matching headshots for teams of 5 or more",
        price: "$125",
        priceNote: "Per person · minimum 5 people",
        duration: "15 min per person",
        inclusions: [
          "Consistent framing + lighting across the team",
          "1 retouched image per person",
          "On-location or studio",
          "Single shared gallery for HR",
        ],
      },
      {
        name: "Professional",
        tagline: "Multiple looks for serious personal branding",
        price: "$375",
        duration: "45 minutes",
        featured: true,
        inclusions: [
          "2 backgrounds",
          "5 final retouched images",
          "Multiple poses and expressions",
          "Wardrobe guidance",
          "48-hour turnaround",
        ],
      },
      {
        name: "Individual",
        tagline: "Quick turnaround for one person, one look",
        price: "$200",
        duration: "20 minutes",
        inclusions: [
          "1 background",
          "3 final retouched images",
          "Coaching on posture + expression",
          "48-hour turnaround",
        ],
      },
    ],
    addOns: [
      { name: "Additional retouched image", price: "$25 each" },
      { name: "Additional background", price: "$50" },
      { name: "Rush delivery (24 hours)", price: "$100" },
      { name: "Extra person (Team Bundle expansion)", price: "$125" },
    ],
  },
  {
    slug: "corporate-events",
    title: "Corporate Events",
    tagline: "Conferences, launches, galas — covered.",
    description:
      "Conferences, product launches, and galas across the DMV.",
    intro: [
      "Corporate events deserve the same documentary eye as weddings. I cover the keynote and the grip-and-grins, but I also hunt down the unscripted moments — the sidebar conversations, the laugh during the Q&A, the engineer frantically fixing the demo backstage.",
      "Same-day social-media selects are available on request so your marketing team can post while the event is still live. Full gallery delivery follows within a week.",
      "Pick the length of coverage below that fits your program — from a focused half-day to multi-day conference runs.",
    ],
    packages: [
      {
        name: "Multi-Day Conference",
        tagline: "Ongoing coverage across a multi-day program",
        price: "Custom quote",
        inclusions: [
          "Dedicated photographer across the full program",
          "Daily social selects delivered overnight",
          "Second shooter available",
          "Dedicated editing turnaround schedule",
        ],
      },
      {
        name: "Full Day",
        tagline: "End-to-end coverage for single-day events",
        price: "$1,800",
        duration: "8 hours",
        featured: true,
        inclusions: [
          "Full event documentation",
          "300+ edited photos",
          "Same-day social selects (up to 20)",
          "1-week full gallery delivery",
        ],
      },
      {
        name: "Half-Day",
        tagline: "A focused half-day of coverage",
        price: "$950",
        duration: "4 hours",
        inclusions: [
          "Full event documentation",
          "150+ edited photos",
          "Same-day social selects (up to 10)",
          "1-week full gallery delivery",
        ],
      },
    ],
    addOns: [
      { name: "Second shooter", price: "$500" },
      { name: "Extra hour of coverage", price: "$200" },
      { name: "Rush gallery delivery (24 hours)", price: "$250" },
      { name: "Same-day edited social selects", price: "$150" },
      { name: "Branded photo-booth corner (logo backdrop)", price: "$400" },
    ],
    pricingNote:
      "Need video alongside stills? I've started taking on select video projects — ask about combined coverage.",
  },
  {
    slug: "promotional",
    title: "Brand & Promotional",
    tagline: "Photography for studios, small businesses, and apartment communities.",
    description:
      "Promo content for fitness and yoga studios, apartment-community events, and small businesses across the DMV.",
    intro: [
      "If your business needs a steady stream of photos that actually look like your space, your people, and your vibe — that's what this category is for. I've shot fitness and yoga classes for promo, instructor portraits, and community events at apartment buildings (outdoor happy hours, holiday parties, flea markets) that double as marketing content for the property.",
      "Every shoot is built around how you'll actually use the photos: social posts, web hero images, flyers, leasing decks, instructor headshots, recap reels — whatever the channel calls for. I'll plan a shot list with you ahead of time so we get the social-ready selects fast and the full gallery shortly after.",
      "Pick the package below that fits the scope of your event or campaign — and reach out if you're running an ongoing series, since recurring schedules get a discounted rate.",
    ],
    packages: [
      {
        name: "Promo Half-Day",
        tagline: "Multi-class days, full apartment events, or full-vendor flea markets",
        price: "$1,200",
        duration: "4 hours",
        inclusions: [
          "Full event or studio coverage",
          "150+ edited photos",
          "Same-day social selects (up to 15)",
          "1-week full gallery delivery",
          "Commercial usage rights",
        ],
      },
      {
        name: "Community Event",
        tagline: "Apartment happy hours, holiday parties, and resident events",
        price: "$750",
        duration: "3 hours",
        featured: true,
        inclusions: [
          "Full event documentation",
          "Resident candids + atmosphere shots",
          "Vendor and decor coverage",
          "100+ edited photos",
          "Same-day social selects (up to 10)",
          "Commercial usage rights",
        ],
      },
      {
        name: "Class / Workshop Shoot",
        tagline: "Single fitness or yoga class with action + portraits of the instructor",
        price: "$450",
        duration: "90 minutes",
        inclusions: [
          "In-class action coverage",
          "Instructor portraits",
          "Studio interior + branded detail shots",
          "40+ edited photos",
          "Commercial usage rights",
        ],
      },
      {
        name: "Brand Mini",
        tagline: "Quick instructor or storefront promo session",
        price: "$300",
        duration: "45 minutes",
        inclusions: [
          "1 location",
          "20+ edited photos",
          "Headshot + lifestyle frames",
          "48-hour turnaround",
          "Commercial usage rights",
        ],
      },
    ],
    addOns: [
      { name: "Same-day edited social selects", price: "$150" },
      { name: "Vertical reels / BTS clips", price: "$200" },
      { name: "Branded photo-booth corner (logo backdrop)", price: "$300" },
      { name: "Extra hour of coverage", price: "$200" },
      { name: "Rush gallery delivery (24 hours)", price: "$150" },
    ],
    pricingNote:
      "Recurring schedules — monthly classes, quarterly resident events — get a discounted rate. Ask about a retainer.",
  },
];

// Visible-only helpers — used by nav, listings, sitemap, generateStaticParams.
// Hidden categories stay in the source array so we don't lose the content,
// but they get excluded from anything indexable or user-facing.
export const visibleServices = services.filter((s) => !s.hidden);

// Portfolio galleries. Placeholder images until Julian exports originals from
// Adobe Portfolio and drops them into /public/portfolio/<slug>/.
export const portfolios: PortfolioCategory[] = [
  {
    slug: "weddings",
    title: "Weddings",
    description: "Full wedding days, from quiet prep to the last dance.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "engagements",
    title: "Engagements",
    description: "Relaxed sessions that feel like the two of you.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "graduation",
    title: "Graduation",
    description: "Solo and group sessions across the DMV.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "portraiture",
    title: "Portraiture",
    description: "Individual portraits — guided and natural.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "modeling",
    title: "Modeling",
    description: "Test shoots, portfolios, and editorial work.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
    hidden: true,
  },
  {
    slug: "family",
    title: "Family Events",
    description: "Birthdays, reunions, and milestone moments.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "maternity",
    title: "Maternity",
    description: "Patient, soft sessions to mark the wait.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "corporate-headshots",
    title: "Corporate Headshots",
    description: "Consistent, polished headshots for teams and individuals.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "corporate-events",
    title: "Corporate Events",
    description: "Conferences, launches, galas, and team events.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "promotional",
    title: "Brand & Promotional",
    description:
      "Studios, instructor portraits, apartment community events, and small-business promo.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
];

export const visiblePortfolios = portfolios.filter((p) => !p.hidden);

export function getService(slug: string) {
  const s = services.find((s) => s.slug === slug);
  return s && !s.hidden ? s : undefined;
}

export function getPortfolio(slug: string) {
  const p = portfolios.find((p) => p.slug === slug);
  return p && !p.hidden ? p : undefined;
}
