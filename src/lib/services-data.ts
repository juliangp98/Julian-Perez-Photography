// Pure-data module: exports the hard-coded `services` array (the 16
// service categories with packages, add-ons, FAQs, etc.) with zero
// runtime imports (just types). This isolation matters because the seed
// script (`scripts/seed-sanity.ts`) imports from here under tsx without
// pulling React, Next, or the Sanity client into scope — all of which
// `src/lib/content.ts` transitively pulls in via `getSiteSettings`.
//
// Everyday call sites keep importing `services` from `@/lib/content`
// (it re-exports from here); only the seed script reaches into this
// file directly.

import type { ServiceCategory } from "./types";

export const services: ServiceCategory[] = [
  // ==========================================================================
  // 1. WEDDINGS & COUPLES
  // ==========================================================================
  {
    slug: "weddings",
    umbrella: "weddings-couples",
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
      "Packages are detailed below, but I also offer custom solutions tailored to your unique needs. For Wedding Packages that include an Engagement Session, see the [Engagements & Couples page](/services/engagements-couples) for session details. Celebrating an anniversary or planning a vow renewal? See the dedicated package below — same documentary approach, scaled to the day you're planning.",
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
        tagline: "Elopements, civil ceremonies, and intimate ceremonies",
        price: "$800",
        duration: "Ceremony + portraits + newlywed shots",
        inclusions: ["100+ edited photos", "Solo photographer"],
      },
      {
        name: "Vow Renewal & Anniversary",
        tagline: "A second 'I do' or a milestone anniversary, fully covered",
        price: "$1,400",
        duration: "Ceremony + portraits + reception (up to 4 hours)",
        inclusions: [
          "Ceremony or vow-renewal coverage",
          "Couple + family portraits",
          "Reception or celebration dinner",
          "150+ edited photos",
          "10-photo sneak peek within 72 hours",
          "Online gallery with print release",
        ],
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
    faqs: [
      {
        question:
          "How much does wedding photography cost in Northern Virginia?",
        answer:
          "My wedding packages range from $2,400 to $3,600 depending on coverage length and extras like a second shooter or album. I also offer an $800 elopement package and a $1,400 vow renewal option. Every package includes a private gallery, full print release, and a 72-hour sneak peek.",
      },
      {
        question: "Do you include a second photographer for weddings?",
        answer:
          "Yes — a second shooter is included with the Silver ($2,800), Premium ($3,200), and Platinum ($3,600) packages. For the Essentials package, you can add one for $400.",
      },
      {
        question: "How long until we get our wedding photos back?",
        answer:
          "You'll receive a sneak peek of 10-25 photos within 72 hours of your wedding day. The full gallery is typically delivered within a few weeks, or you can add rush delivery for $250 to get it in two weeks.",
      },
      {
        question:
          "Do you travel for weddings outside the DC / Maryland / Virginia area?",
        answer:
          "Absolutely. I'm based in Northern Virginia and cover the entire DMV at no extra charge. For destination weddings further out, just reach out — I'll put together a custom quote that includes travel.",
      },
      {
        question:
          "Can I add an engagement session to my wedding package?",
        answer:
          "Engagement sessions are already included with Silver, Premium, and Platinum wedding packages at no additional cost. If you're booking the Essentials package, you can add a standalone engagement session from the Engagements & Couples page.",
      },
    ],
  },
  {
    slug: "engagements-couples",
    umbrella: "weddings-couples",
    title: "Engagements & Couples",
    tagline: "A relaxed session to celebrate the two of you.",
    description:
      "Engagement, anniversary, and couples sessions across the DMV — included with most wedding packages.",
    intro: [
      "Engagement and couples sessions are where we get to know each other before the big day — or just where we celebrate the two of you, no big day required. It's a low-pressure afternoon that doubles as a rehearsal: you practice being photographed, I learn your rhythm as a couple, and we both walk away with photos that look like the version of you that you actually want to remember.",
      "Just married? Just got engaged? Five years in and overdue for new wall art? Anniversary, dating-app refresh, save-the-date — they all fit here. Come as yourselves, dress the way you'd actually want to be remembered, and let the session feel like a long walk together with a camera quietly tagging along.",
      "Whether you're warming up for the wedding, marking a milestone, or surprising someone with a proposal — pick the pace below that fits your story.",
    ],
    comboNote:
      "Booking a wedding? Engagement sessions are included with the Silver, Premium, and Platinum [wedding packages](/services/weddings).",
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
    faqs: [
      {
        question:
          "How much do engagement photos cost in the DC area?",
        answer:
          "Engagement sessions start at $300 for a 45-minute session and go up to $400 for a 2-hour Premium session with multiple outfits and locations. If you're also booking a wedding package at the Silver level or above, an engagement session is included at no extra cost.",
      },
      {
        question:
          "Can you photograph a surprise proposal in Washington DC?",
        answer:
          "Yes! I offer a dedicated Surprise Proposal package for $350. I'll coordinate timing and positioning with you ahead of time, stay hidden until the moment happens, and then transition into a portrait session right after the yes.",
      },
      {
        question:
          "What's the best time of year for engagement photos in Northern Virginia?",
        answer:
          "Golden hour in spring and fall is hard to beat in the DMV — the light is warm and the crowds thin out in the evening. That said, every season has something going for it. I'll help you pick a location and time that works for the look you want.",
      },
      {
        question:
          "Is an engagement session included with wedding packages?",
        answer:
          "Yes — engagement sessions are included with the Silver ($2,800), Premium ($3,200), and Platinum ($3,600) wedding packages. It's a great way for us to get comfortable working together before the big day.",
      },
    ],
  },

  // ==========================================================================
  // 2. FAMILY & LIFE EVENTS
  // ==========================================================================
  {
    slug: "maternity",
    umbrella: "family-life",
    title: "Maternity",
    tagline: "Soft, patient, and yours to keep.",
    description:
      "Outdoor or studio maternity sessions planned around your comfort.",
    intro: [
      "Maternity sessions should feel peaceful, not performative. I plan around how you're actually feeling that week: comfortable locations, relaxed pacing, and as many breaks as you need. Partner and sibling shots are always included at no extra cost.",
      "I can help with wardrobe ideas, sourcing flowy dresses, and scouting locations with shade and easy access. The goal is photos that look like a quiet love letter to the three, four, or five of you.",
      "The tiers below range from a gentle portrait session to a full styled experience — choose whichever matches how much of the story you want told.",
    ],
    comboNote:
      "Planning ahead? Bundle your maternity session with a [Newborn & First Year package](/services/newborn) for a discounted rate. Throwing a baby shower or gender reveal too? Those live on the [Family Celebrations](/services/family-celebrations) page.",
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
      { name: "Studio rental", price: "$100" },
    ],
    faqs: [
      {
        question:
          "How much does a maternity photo session cost in Northern Virginia?",
        answer:
          "Maternity sessions range from $350 for a 45-minute Essentials session to $725 for the Premium package, which includes both studio and outdoor locations, unlimited outfit changes, and a full styling consult. The most popular option is the Signature at $525 for 90 minutes.",
      },
      {
        question:
          "When should I schedule my maternity session?",
        answer:
          "Most moms book between 28 and 34 weeks, but there's no strict rule — we'll plan around how you're feeling. I keep the pacing relaxed with plenty of breaks, and I'm happy to reschedule if the timing shifts.",
      },
      {
        question:
          "Can my partner and kids be in the maternity photos?",
        answer:
          "Absolutely — partner and sibling shots are always included at no extra charge, no matter which package you choose. The more the merrier.",
      },
      {
        question:
          "Do you help with outfits and wardrobe for maternity sessions?",
        answer:
          "Yes! The Premium and Signature packages include wardrobe guidance, and I can help source flowy dresses and suggest colors that photograph beautifully. I'll also scout locations with shade and easy access so you're comfortable the whole time.",
      },
      {
        question:
          "Can I bundle maternity and newborn sessions together?",
        answer:
          "You can — and you'll get a discounted rate when you do. A lot of families book maternity plus the First Year Bundle so the whole arc from bump to first birthday is captured in one cohesive style.",
      },
    ],
  },
  {
    slug: "newborn",
    umbrella: "family-life",
    title: "Newborn & First Year",
    tagline: "The tiny days, the big year.",
    description:
      "In-home newborn sessions and first-year milestone bundles across the DMV.",
    intro: [
      "Newborn sessions are quiet, slow, and built entirely around the baby. I shoot in your home so the baby stays in their own space and you don't have to pack the world into a diaper bag — natural light, simple wraps, and plenty of feeding and snuggle breaks.",
      "If you want to document more than just the first weeks, the First Year Bundle covers newborn, 6-month sitter session, and the 1-year cake-smash so you have a single cohesive set of photos at the end of year one — all edited in the same style so they look like a series, not three random shoots.",
      "Sibling and parent shots are always welcome — pick the package that fits the chapter you're in.",
    ],
    comboNote:
      "Booked a [maternity session](/services/maternity) with me? You'll get a discounted rate on any newborn or first-year package — ask when you book. If you'd rather mark the 1st birthday with a full party instead of the cake-smash mini, [Family Celebrations](/services/family-celebrations) has documentary event coverage built for it.",
    packages: [
      {
        name: "First Year Bundle",
        tagline: "Three sessions across the first year — newborn, 6mo, 1yr",
        price: "$1,400",
        duration: "3 sessions",
        featured: true,
        inclusions: [
          "Newborn in-home session (2 hours)",
          "6-month sitter session (45 minutes)",
          "1-year cake-smash session (60 minutes)",
          "60+ edited photos per session",
          "Cohesive editing across all three",
          "Sibling + parent shots included",
          "Prints included",
        ],
      },
      {
        name: "Newborn In-Home",
        tagline: "A slow, quiet morning in your space",
        price: "$525",
        duration: "2 hours",
        inclusions: [
          "Posed and lifestyle frames",
          "40+ edited photos",
          "Sibling + parent shots included",
          "Wardrobe + wrap suggestions",
          "Online gallery with print release",
        ],
      },
      {
        name: "Milestone Mini",
        tagline: "Sitter (6mo) or cake-smash (1yr) standalone session",
        price: "$300",
        duration: "45 minutes",
        inclusions: [
          "1 location (in-home or outdoor)",
          "25+ edited photos",
          "Backdrop + props provided",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Extended in-home session (+1 hour)", price: "$150" },
      { name: "Hand-tied newborn wrap (yours to keep)", price: "$60" },
      { name: "Cake-smash setup styling", price: "$100" },
      { name: "Rush gallery delivery (72 hours)", price: "$75" },
      { name: "Print package (10 × 5×7)", price: "$110" },
    ],
    pricingNote:
      "First Year Bundle is interest-free over three payments — one at each session.",
    faqs: [
      {
        question:
          "How much does newborn photography cost in the DMV area?",
        answer:
          "A standalone in-home newborn session is $525 for 2 hours. If you'd like to capture the whole first year, the First Year Bundle is $1,400 and includes three sessions — newborn, 6-month, and 1-year cake smash — with interest-free payments split across each session.",
      },
      {
        question:
          "Do you come to our home for newborn photos?",
        answer:
          "Yes — all newborn sessions are in-home so your baby stays comfortable in their own space. I use natural light from your windows and bring simple wraps and props. No packing up the diaper bag required.",
      },
      {
        question:
          "When should we schedule a newborn photo session?",
        answer:
          "The sweet spot is within the first two weeks, when babies are sleepiest and most curl-able. That said, I keep sessions slow and flexible with plenty of feeding and snuggle breaks, so don't stress about hitting an exact window.",
      },
      {
        question:
          "What is the First Year Bundle and how does the payment plan work?",
        answer:
          "The First Year Bundle ($1,400) covers three sessions across your baby's first year: newborn, 6-month sitter, and 1-year cake smash. It's split into three interest-free payments — one at each session — so you're never paying for the whole thing up front.",
      },
    ],
  },
  {
    slug: "family-portraits",
    umbrella: "family-life",
    title: "Family Portraits",
    tagline: "The people who make home feel like home.",
    description:
      "Posed and candid portrait sessions for families across the DMV.",
    intro: [
      "Family portrait sessions are part documentary, part orchestrated. I'll help organize the big group shots everyone will want printed, and then step back so the kids can be kids and the grown-ups can actually enjoy themselves.",
      "These work for annual family photos, holiday cards, extended-family shoots when everyone's finally in town, or just because the last set of photos has the wrong people in it. I'll help you pick a location, coordinate outfits, and pace the session so even the smallest humans don't melt down.",
      "Pick the size and style of session below that fits how your family actually shows up.",
    ],
    comboNote:
      "Throwing a birthday, reunion, or milestone party instead? Check out [Family Celebrations](/services/family-celebrations) for documentary-style event coverage.",
    packages: [
      {
        name: "Premium",
        tagline: "Multiple looks, multiple locations, full sneak peek",
        price: "$625",
        duration: "90 minutes",
        inclusions: [
          "Up to 15 people",
          "2 outfits",
          "1–2 locations",
          "60+ edited photos",
          "Wardrobe + location planning call",
          "Sneak peek within 72 hours",
          "Online gallery with print release",
        ],
      },
      {
        name: "Signature",
        tagline: "The standard family portrait experience",
        price: "$425",
        duration: "60 minutes",
        featured: true,
        inclusions: [
          "Up to 10 people",
          "1 outfit",
          "1 location",
          "40+ edited photos",
          "Posed group shots + candids",
          "Online gallery with print release",
        ],
      },
      {
        name: "Mini",
        tagline: "A short session for just the immediate family",
        price: "$275",
        duration: "30 minutes",
        inclusions: [
          "Up to 6 people",
          "1 location",
          "20+ edited photos",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Extra 30 minutes of coverage", price: "$100" },
      { name: "Additional location (within 5 mi)", price: "$50" },
      { name: "Group of 15+ (extended family)", price: "$100" },
      { name: "Holiday card design (digital file)", price: "$75" },
      { name: "Print package (5 × 8×10)", price: "$85" },
    ],
    faqs: [
      {
        question:
          "How much do family photos cost in Northern Virginia?",
        answer:
          "Family portrait sessions start at $275 for a 30-minute mini (up to 6 people) and go up to $625 for a 90-minute Premium session that covers up to 15 people with multiple outfits and locations. The most popular is the Signature at $425 for 60 minutes.",
      },
      {
        question:
          "What should we wear for a family photo session?",
        answer:
          "I'll help you coordinate outfits before the session — the goal is complementary colors and textures, not everyone in matching white shirts. I send a wardrobe guide after booking and I'm always happy to review outfit options over text.",
      },
      {
        question:
          "Can you handle a large extended family group?",
        answer:
          "Absolutely. The Premium package covers up to 15 people, and for groups larger than that I offer an extended family add-on for $100. I'll organize the group shots efficiently so nobody's standing around too long.",
      },
      {
        question:
          "Do you offer holiday card photo sessions in the DC area?",
        answer:
          "I do — any family session can double as your holiday card shoot. I also offer a $75 holiday card design add-on so you get a ready-to-print digital file along with your gallery.",
      },
    ],
  },
  {
    slug: "family-celebrations",
    umbrella: "family-life",
    title: "Family Celebrations",
    tagline: "Birthdays, reunions, and the ones you'll want to remember.",
    description:
      "Documentary coverage for 1st birthdays, baby showers, gender reveals, reunions, and milestone family parties.",
    intro: [
      "Family celebrations deserve the same documentary eye as a wedding. Whether it's a 1st birthday, a baby shower, a gender reveal, a backyard reunion, or a milestone you've been waiting years to celebrate together — I treat every family event like a mini wedding. Full coverage, gentle direction for the group shots, and the kind of candids that get sent around the family group chat for years.",
      "I'll arrive early enough to get the setup details (cake, decor, table settings) before guests show up, then shift into documentary mode as the party fills out. You get the stress-free version of the event: be present with your people, and I'll handle the rest.",
      "Pick the length of coverage below that fits the gathering — from a focused two-hour celebration to a full day-of milestone.",
    ],
    comboNote:
      "Just want a posed family session instead of full event coverage? Head over to [Family Portraits](/services/family-portraits).",
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
          "Setup + decor detail coverage",
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
          "Up to 30 people",
          "Full event documentation",
          "60+ edited photos",
          "Sneak peek within 72 hours",
          "Online gallery with download + print rights",
        ],
      },
      {
        name: "Gathering",
        tagline: "Shorter coverage for intimate parties",
        price: "$450",
        duration: "2 hours",
        inclusions: [
          "Up to 15 people",
          "1 location",
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
      { name: "Same-day social selects (up to 10)", price: "$150" },
    ],
    faqs: [
      {
        question:
          "How much does a birthday party photographer cost in the DC area?",
        answer:
          "Event coverage starts at $450 for 2 hours (up to 15 guests) and goes up to $950 for 4 hours of full milestone coverage. The most popular Celebration package is $650 for 3 hours and covers up to 30 people.",
      },
      {
        question:
          "Do you photograph first birthday parties and baby showers?",
        answer:
          "Yes — 1st birthdays, baby showers, gender reveals, and family reunions are exactly what this service is built for. I treat each one like a mini wedding: I arrive early to capture the setup details, then shift to documentary mode once guests arrive.",
      },
      {
        question:
          "Can we get same-day photos for social media?",
        answer:
          "You can! Same-day social selects (up to 10 edited photos) are available as a $150 add-on so you can post while the party is still fresh in everyone's mind.",
      },
      {
        question:
          "What's the difference between family celebrations and family portraits?",
        answer:
          "Family portraits are posed and candid sessions focused on your family — think annual photos or holiday cards. Family celebrations are documentary event coverage for parties and gatherings where I'm capturing the whole scene as it unfolds.",
      },
    ],
  },
  {
    slug: "cultural-milestones",
    umbrella: "family-life",
    title: "Cultural Milestones",
    tagline: "The day everyone's been waiting for.",
    description:
      "Quinceañeras, Sweet 16s, Bar/Bat Mitzvahs, and cultural milestone celebrations across the DMV.",
    intro: [
      "Cultural milestones — Quinceañeras, Sweet 16s, Bar and Bat Mitzvahs, debuts — are once-in-a-lifetime celebrations that deserve once-in-a-lifetime photos. I cover the full arc: pre-event portrait session in the dress or suit, getting-ready moments, ceremony or church service, formal portraits, and the reception from first dance to the last sparkler.",
      "I work bilingual-friendly (Spanish or English) and I'm comfortable with traditional ceremonies — the waltz, the changing of the shoes, the doll, the father-daughter dance, the candle-lighting. I'll coordinate with your planner, your church, and your DJ ahead of time so the day runs smoothly.",
      "Pick the level of coverage that fits your celebration — from a standalone portrait session in the dress to full-day documentary coverage.",
    ],
    packages: [
      {
        name: "Full Celebration",
        tagline: "Pre-event portraits + ceremony + reception, end to end",
        price: "$2,400",
        duration: "Full day (8 hours)",
        featured: true,
        inclusions: [
          "Pre-event portrait session (separate day)",
          "Getting-ready coverage",
          "Ceremony / church service",
          "Formal family portraits",
          "Full reception coverage",
          "400+ edited photos",
          "20-photo sneak peek within 72 hours",
          "Online gallery with print release",
        ],
      },
      {
        name: "Reception Coverage",
        tagline: "Ceremony + reception, no pre-event session",
        price: "$1,600",
        duration: "6 hours",
        inclusions: [
          "Ceremony / church service",
          "Formal family portraits",
          "Reception (entrances → first dances → cake)",
          "300+ edited photos",
          "Sneak peek within 72 hours",
          "Online gallery with print release",
        ],
      },
      {
        name: "Pre-Event Portraits",
        tagline: "A standalone session in the dress, suit, or traditional attire",
        price: "$525",
        duration: "90 minutes",
        inclusions: [
          "1–2 locations",
          "Solo + family portraits",
          "50+ edited photos",
          "Sneak peek within 48 hours",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Second shooter for full day", price: "$500" },
      { name: "Extra hour of reception coverage", price: "$250" },
      { name: "Custom photo album (linen, 30 pages)", price: "$350" },
      { name: "Same-day edited social selects", price: "$200" },
      { name: "Rush gallery delivery (1 week)", price: "$200" },
    ],
    pricingNote:
      "Bilingual coordination available (English / Spanish). Reach out if your celebration includes traditions I should plan for.",
    faqs: [
      {
        question:
          "How much does a quinceañera photographer cost in Northern Virginia?",
        answer:
          "Full-day quinceañera coverage starts at $2,400 and includes a pre-event portrait session, getting-ready coverage, ceremony, formal portraits, and full reception documentation. If you only need ceremony and reception, the $1,600 package covers 6 hours.",
      },
      {
        question:
          "Do you photograph Bar Mitzvahs and Sweet 16s in the DMV?",
        answer:
          "I do — Bar and Bat Mitzvahs, Sweet 16s, debuts, and other cultural milestone celebrations are all covered. The same packages and pricing apply, and I'll coordinate with your planner, venue, and DJ ahead of time.",
      },
      {
        question:
          "Do you speak Spanish for quinceañera coordination?",
        answer:
          "Yes — I'm bilingual (English and Spanish) and comfortable coordinating with families, planners, and church staff in either language. I'm also familiar with traditional ceremony elements like the waltz, the changing of the shoes, and the last doll.",
      },
      {
        question:
          "Can I book just a portrait session in the dress without full event coverage?",
        answer:
          "Absolutely. The Pre-Event Portraits package is $525 for a 90-minute session at 1-2 locations and includes solo and family portraits — no event coverage needed.",
      },
    ],
  },
  {
    slug: "pet",
    umbrella: "family-life",
    title: "Pet Photography",
    tagline: "The four-legged member of the family deserves wall art too.",
    description:
      "In-home and outdoor pet portrait sessions across the DMV.",
    intro: [
      "Pets are family — and pet sessions are some of my favorite shoots. I work at the pace of the animal, not the other way around: lots of treats, plenty of breaks, and a relaxed approach that gets you photos that actually look like your pet's personality, not a stiff studio pose.",
      "Sessions work for in-home portraits (ideal for older dogs, cats, or shy pups), outdoor adventures (great for high-energy dogs), or as a family-with-pet add-on. I'll bring squeakers, treats, and patience.",
      "Pick the version below that fits where your pet is most themselves.",
    ],
    packages: [
      {
        name: "Pet + Family",
        tagline: "A full session that includes the humans too",
        price: "$525",
        duration: "75 minutes",
        inclusions: [
          "1 pet + immediate family",
          "1–2 locations (in-home or outdoor)",
          "50+ edited photos",
          "Solo pet portraits + group shots",
          "Online gallery with print release",
        ],
      },
      {
        name: "Outdoor Adventure",
        tagline: "A relaxed walk-and-shoot at your favorite trail or park",
        price: "$375",
        duration: "60 minutes",
        featured: true,
        inclusions: [
          "1 outdoor location",
          "1 pet (additional pets +$50)",
          "40+ edited photos",
          "Action and portrait frames",
          "Online gallery with print release",
        ],
      },
      {
        name: "In-Home",
        tagline: "A quiet session at your pet's most comfortable spot",
        price: "$275",
        duration: "45 minutes",
        inclusions: [
          "Your home — no travel for your pet",
          "1 pet (additional pets +$50)",
          "30+ edited photos",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Additional pet", price: "$50" },
      { name: "Extra 30 minutes", price: "$100" },
      { name: "Memorial session (older pet, gentle pacing)", price: "Included — just ask" },
      { name: "Print package (5 × 8×10)", price: "$85" },
      { name: "Custom framed canvas (16×20)", price: "$120" },
    ],
    pricingNote:
      "Memorial sessions for senior pets are handled with extra care — reach out and we'll find a pace that works.",
    faqs: [
      {
        question:
          "How much does pet photography cost in the DC area?",
        answer:
          "Pet sessions start at $275 for a 45-minute in-home session and go up to $525 for a 75-minute Pet + Family session that includes portraits of the humans too. Additional pets are just $50 each.",
      },
      {
        question:
          "Do you offer memorial sessions for senior or aging pets?",
        answer:
          "I do, and there's no extra charge — memorial sessions are included at the same rate as any other pet session. I'll work at a gentle pace with extra patience and breaks so your pet stays comfortable the whole time.",
      },
      {
        question:
          "Can you photograph my cat or is this only for dogs?",
        answer:
          "Cats, dogs, rabbits, horses — I'm game for all of them. In-home sessions work especially well for cats and shy pets since they're already in their comfort zone. I bring treats, squeakers, and plenty of patience.",
      },
      {
        question:
          "What if my dog won't sit still for photos?",
        answer:
          "That's totally normal and honestly makes for the best photos. I work at the pace of the animal, not the other way around — lots of treats, breaks, and a relaxed approach. High-energy dogs do great with the Outdoor Adventure session where they can just be themselves.",
      },
    ],
  },

  // ==========================================================================
  // 3. PERSONAL & PRO PORTRAITS
  // ==========================================================================
  {
    slug: "portraiture",
    umbrella: "portraits-pro",
    title: "Portraiture",
    tagline: "Portraits that actually look like you.",
    description:
      "Individual sessions for creatives, professionals, and personal branding.",
    intro: [
      "A good portrait isn't about a perfect pose — it's about looking like yourself on a really good day. I lean on guided direction and natural conversation to make the session feel like hanging out, not a performance.",
      "Sessions work for personal branding, creative portfolios, anniversary gifts, artist headshots, dating-app refreshes, or just because you deserve a set of photos you actually love. Studio or outdoors, I'll help you plan wardrobe, location, and pacing before we shoot.",
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
    faqs: [
      {
        question:
          "How much does a portrait session cost in Northern Virginia?",
        answer:
          "Portrait sessions start at $275 for a 30-minute Essentials session and go up to $625 for the 90-minute Premium, which includes unlimited outfit changes and multiple locations. Every package includes a full print release.",
      },
      {
        question:
          "What kinds of portraits do you shoot?",
        answer:
          "A little bit of everything — personal branding, creative portfolios, artist headshots, dating app refreshes, anniversary gifts, or just a set of photos you actually love. Studio or outdoor, I'll help plan wardrobe and location before the session.",
      },
      {
        question:
          "I'm not photogenic — will I feel awkward?",
        answer:
          "Most people say that, and most people are wrong. I use gentle posing direction and natural conversation to keep things relaxed — it should feel like hanging out, not performing. You'll look like yourself on a really good day.",
      },
      {
        question:
          "Can I use the portraits for my business or personal brand?",
        answer:
          "Yes — every portrait package includes a full print release, so you can use the images on your website, LinkedIn, social media, or anywhere else you need them.",
      },
    ],
  },
  {
    slug: "graduation",
    umbrella: "portraits-pro",
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
    faqs: [
      {
        question:
          "How much do graduation photos cost in the DC area?",
        answer:
          "Solo grad sessions start at $225 for a 30-minute Mini Cap & Gown and go up to $350 for the 60-minute Signature Graduate with two outfits and multiple locations. Group sessions start at $360 for two graduates.",
      },
      {
        question:
          "Can you take graduation photos at the National Mall or monuments?",
        answer:
          "Yes — the National Mall, Lincoln Memorial, and other monuments are popular spots for DC-area graduation sessions. I handle the permit process for you as a $150 add-on so you don't have to worry about the paperwork.",
      },
      {
        question:
          "Do you offer group graduation sessions for friends?",
        answer:
          "I do! The Study Group Session starts at $360 for two graduates and adds $60 per additional grad. Each person gets at least 5 individual portraits plus group shots — a great way to split the cost and celebrate together.",
      },
      {
        question:
          "Can my family be in the graduation photos too?",
        answer:
          "Absolutely. The Family Graduation Session ($325 for 60 minutes) is designed for exactly that — solo cap-and-gown portraits mixed with proud family shots. Extra family members are just $25 each beyond the base group of four.",
      },
    ],
  },
  {
    slug: "corporate-headshots",
    umbrella: "portraits-pro",
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
        group: "Team",
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
        group: "Team",
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
        group: "Individual",
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
        group: "Individual",
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
    faqs: [
      {
        question:
          "How much do corporate headshots cost in Northern Virginia?",
        answer:
          "Individual headshots start at $200 for a quick 20-minute session with 3 retouched images. For a more in-depth personal branding session, the Professional package is $375 for 45 minutes with 5 retouched images. Team sessions start at $125 per person (minimum 5).",
      },
      {
        question:
          "Can you come to our office for team headshots?",
        answer:
          "Yes — the On-site Half-Day package ($1,200) covers up to 20 headshots at your office. I bring a full mobile lighting kit and backdrop so we can set up in a conference room or lobby and keep everyone's day moving.",
      },
      {
        question:
          "How fast can we get our headshots back?",
        answer:
          "Standard turnaround is 48 hours for individual sessions. For rush jobs, I offer 24-hour delivery for $100. Team galleries are delivered within a week with consistent editing across every person.",
      },
      {
        question:
          "Will our team headshots look consistent and match?",
        answer:
          "That's the whole point — I match lighting, framing, background, and editing across every team member so your About page finally looks cohesive instead of a patchwork of different photographers over the years.",
      },
    ],
  },

  // ==========================================================================
  // 4. BRAND & EVENTS
  // ==========================================================================
  {
    slug: "corporate-community-events",
    umbrella: "brand-events",
    title: "Corporate & Community Events",
    tagline: "Conferences, galas, receptions — covered.",
    description:
      "Conferences, galas, receptions, and community events across the DMV.",
    intro: [
      "Corporate and community events deserve the same documentary eye as weddings. I cover the keynote and the grip-and-grins, but I also seek out the unscripted moments — the sidebar conversations, the laugh during the Q&A, the engineer frantically fixing the demo backstage, residents catching up over a beer at the apartment happy hour.",
      "From multi-day conferences, speaker panels, and nonprofit galas to balls, corporate receptions, social-club anniversary dinners, and Hill receptions, all the way to apartment-community happy hours, holiday parties, and pop-up markets — if it's a live event with people in a room, this is the right page. Same-day social-media selects are available on request so your marketing team can post while the event is just winding down, with full gallery delivery within a week.",
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
      {
        name: "Community Event",
        tagline: "Apartment happy hours, holiday parties, and resident events",
        price: "$750",
        duration: "3 hours",
        inclusions: [
          "Full event documentation",
          "Resident candids + atmosphere shots",
          "Vendor and decor coverage",
          "100+ edited photos",
          "Same-day social selects (up to 10)",
          "Commercial usage rights",
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
    comboNote:
      "Booking a live music show, a band's set, or a stage performance instead? That coverage lives on the [Concerts & Performances page](/services/concerts-performances).",
    pricingNote:
      "Recurring schedules — monthly community events, quarterly conferences — get a discounted rate. Need video alongside stills? I've started taking on select video projects — ask about combined coverage.",
    faqs: [
      {
        question:
          "How much does event photography cost in the DC area?",
        answer:
          "Event coverage starts at $750 for 3 hours (community events) and goes up to $1,800 for a full 8-hour day. Multi-day conferences are custom quoted. Same-day social selects are available so your team can post while the event is still happening.",
      },
      {
        question:
          "Do you photograph corporate conferences and galas in DC?",
        answer:
          "Yes — conferences, galas, receptions, nonprofit events, and Hill receptions are all in my wheelhouse. I cover keynotes, panels, candid networking moments, and formal posed shots with the same documentary approach.",
      },
      {
        question:
          "Can we get same-day photos for social media during the event?",
        answer:
          "Absolutely. Same-day social selects are included with most packages — up to 20 edited images for full-day coverage. Your marketing team can start posting while the event is still winding down.",
      },
      {
        question:
          "Do you offer discounts for recurring events?",
        answer:
          "I do — recurring schedules like monthly community events, quarterly conferences, or regular apartment happy hours get a discounted rate. Reach out and I'll put together a retainer that makes sense for your calendar.",
      },
    ],
  },
  {
    slug: "concerts-performances",
    umbrella: "brand-events",
    title: "Concerts & Performances",
    tagline: "Stage lights, sweat, and the song you didn't want to end.",
    description:
      "Live concerts, band sets, recitals, and stage performances across the DMV.",
    intro: [
      "Concert and performance photography is its own discipline — fast-changing light, unpredictable movement, and a single chance to catch the moment the crowd loses it. I shoot the headliner and the openers, the soundcheck and the load-out, the front-row faces and the bassist's grin three songs in.",
      "Whether you're a touring artist passing through DC, a local band playing your album release, a venue building a year-end recap, or an organizer documenting a recital, showcase, or stage performance — I'll work with your stage manager and lighting crew so I'm never in the way of the show. Same-day social selects are available so your team can post while people are still talking about the set.",
      "Pick the package below that fits the run of the show — single set, full bill, or multi-night residency.",
    ],
    comboNote:
      "Coverage for the brand or venue side of the night (sponsor activations, lobby photo wall, VIP meet-and-greet posed shots) lives on the [Brand & Commercial Content](/services/brand-commercial) page. If your event is more reception or gala than concert, [Corporate & Community Events](/services/corporate-community-events) is the right fit.",
    packages: [
      {
        name: "Multi-Night Residency",
        tagline: "Multi-night runs, festivals, and full tours stops",
        price: "Custom quote",
        inclusions: [
          "Dedicated photographer across the run",
          "Daily social selects delivered overnight",
          "Crowd, stage, and backstage coverage",
          "Full gallery + tour-ready exports",
        ],
      },
      {
        name: "Full Bill",
        tagline: "All openers + headliner, doors to load-out",
        price: "$950",
        duration: "Up to 6 hours",
        featured: true,
        inclusions: [
          "Full event documentation",
          "All performing acts covered",
          "Crowd + atmosphere shots",
          "200+ edited photos",
          "Same-day social selects (up to 15)",
          "1-week full gallery delivery",
        ],
      },
      {
        name: "Headliner Set",
        tagline: "A focused set on the main performance",
        price: "$550",
        duration: "Up to 3 hours (3-song rule respected)",
        inclusions: [
          "Headliner set coverage",
          "Crowd + lighting frames",
          "100+ edited photos",
          "Same-day social selects (up to 10)",
          "1-week full gallery delivery",
        ],
      },
      {
        name: "Recital / Showcase",
        tagline: "School recitals, dance showcases, and stage performances",
        price: "$425",
        duration: "Up to 2 hours",
        inclusions: [
          "Full performance coverage",
          "Posed group + cast shots",
          "60+ edited photos",
          "Online gallery with print release",
        ],
      },
    ],
    addOns: [
      { name: "Backstage / green-room coverage", price: "$200" },
      { name: "Soundcheck coverage", price: "$150" },
      { name: "Extra hour of coverage", price: "$200" },
      { name: "Rush gallery delivery (24 hours)", price: "$250" },
      { name: "Vertical reels / BTS clips", price: "$200" },
    ],
    pricingNote:
      "Press credentials and venue clearance are the artist's or venue's responsibility — I'm happy to coordinate directly with your tour manager or venue contact ahead of the show.",
    faqs: [
      {
        question:
          "How much does concert photography cost in the DC area?",
        answer:
          "Concert coverage starts at $425 for a 2-hour recital or showcase and goes up to $950 for a full-bill show covering all acts over 6 hours. Multi-night residencies and festival runs are custom quoted.",
      },
      {
        question:
          "Do you respect the 3-song rule at concerts?",
        answer:
          "Always. I work within whatever access the venue or artist grants — whether that's the standard 3-song rule from the pit or full-set access. I'll coordinate with your tour manager or venue contact ahead of time.",
      },
      {
        question:
          "Can you deliver photos the same night for social media?",
        answer:
          "Yes — same-day social selects are available with most packages, so your team can post while people are still talking about the show. Full galleries are delivered within a week.",
      },
      {
        question:
          "Do you photograph school recitals and dance showcases too?",
        answer:
          "I do. The Recital / Showcase package ($425 for 2 hours) covers the full performance plus posed group and cast shots afterward. It works great for dance recitals, school concerts, and theater showcases.",
      },
    ],
  },
  {
    slug: "brand-commercial",
    umbrella: "brand-events",
    title: "Brand & Commercial Content",
    tagline: "Photography for studios, small businesses, and brand campaigns.",
    description:
      "Class shoots, instructor portraits, product, and lifestyle marketing content across the DMV.",
    intro: [
      "If your business needs a steady stream of photos that actually look like your space, your people, and your vibe — that's what this category is for. I've shot fitness and yoga classes for promo, instructor portraits, product flatlays, and lifestyle marketing content for small DMV brands.",
      "Every shoot is built around how you'll actually use the photos: social posts, web hero images, flyers, leasing decks, instructor headshots, recap reels, product listings — whatever the channel calls for. I'll plan a shot list with you ahead of time so we get the social-ready selects fast and the full gallery shortly after.",
      "Pick the package below that fits the scope of your campaign — and reach out if you're running an ongoing series, since recurring schedules get a discounted rate.",
    ],
    comboNote:
      "Hosting a live event for the brand (class showcase, launch party, resident happy hour)? Those live on the [Corporate & Community Events page](/services/corporate-community-events).",
    packages: [
      {
        name: "Brand Half-Day",
        tagline: "Multi-class days, full studio shoots, or full product catalogs",
        price: "$1,200",
        duration: "4 hours",
        inclusions: [
          "Full studio or location coverage",
          "150+ edited photos",
          "Same-day social selects (up to 15)",
          "1-week full gallery delivery",
          "Commercial usage rights",
        ],
      },
      {
        name: "Class / Workshop Shoot",
        tagline: "Single fitness or yoga class with action + instructor portraits",
        price: "$450",
        duration: "90 minutes",
        featured: true,
        inclusions: [
          "In-class action coverage",
          "Instructor portraits",
          "Studio interior + branded detail shots",
          "40+ edited photos",
          "Commercial usage rights",
        ],
      },
      {
        name: "Product / Lifestyle",
        tagline: "Flatlay or in-context product photography for small brands",
        price: "$400",
        duration: "2 hours",
        inclusions: [
          "Up to 15 product SKUs",
          "Mix of flatlay + lifestyle frames",
          "30+ edited photos",
          "Web-ready exports",
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
      { name: "Extra hour of coverage", price: "$200" },
      { name: "Rush gallery delivery (24 hours)", price: "$150" },
      { name: "Additional product SKUs (per 5)", price: "$75" },
    ],
    pricingNote:
      "Recurring schedules — monthly classes, quarterly product drops — get a discounted rate. Ask about a retainer.",
    faqs: [
      {
        question:
          "How much does brand photography cost in Northern Virginia?",
        answer:
          "Brand content starts at $300 for a 45-minute Brand Mini session and goes up to $1,200 for a half-day shoot covering multiple classes, full studio shoots, or product catalogs. Commercial usage rights are included with every package.",
      },
      {
        question:
          "Do you photograph fitness classes and yoga studios?",
        answer:
          "I do — class and workshop shoots are one of my favorite brand sessions. The Class/Workshop package ($450 for 90 minutes) covers in-class action, instructor portraits, and studio interior shots, all with commercial usage rights included.",
      },
      {
        question:
          "Are commercial usage rights included in the price?",
        answer:
          "Yes — commercial usage rights are included with every brand and commercial package. You can use the images on your website, social media, ads, flyers, and any other marketing materials without additional licensing fees.",
      },
      {
        question:
          "Do you offer discounted rates for recurring brand content?",
        answer:
          "I do. If you're running a regular schedule — monthly class shoots, quarterly product drops, seasonal campaigns — I'll set up a retainer at a discounted per-session rate. Reach out and we'll find a rhythm that works.",
      },
    ],
  },
  {
    slug: "real-estate",
    umbrella: "brand-events",
    title: "Real Estate & Airbnb",
    tagline: "Listing photos that actually move properties.",
    description:
      "Listing photography for agents, property managers, and short-term rental hosts across the DMV.",
    intro: [
      "Listing photos sell the property before anyone walks through the door. I shoot wide, level, and bright — clean verticals, careful exposure blending, and natural light that makes every room look like the version buyers and renters want to imagine themselves in.",
      "I work with realtors on single listings and bulk turnarounds, and with Airbnb / short-term-rental hosts who need a refresh every season or after a renovation. Twilight exterior shots are available as an add-on for the listings that need a marquee hero image.",
      "Pick the tier below that fits the property — and ask about discounted rates for agents who need a steady weekly cadence.",
    ],
    packages: [
      {
        name: "Listing + Twilight",
        tagline: "Full daytime interior + exterior, plus a twilight exterior set",
        price: "$525",
        duration: "Up to 3,500 sq ft",
        featured: true,
        inclusions: [
          "Full interior coverage",
          "Daytime exterior (front + back)",
          "Twilight exterior hero shots",
          "30+ edited photos",
          "MLS-ready exports + web-optimized set",
          "24-hour turnaround",
        ],
      },
      {
        name: "Single Listing",
        tagline: "Standard listing photography for a single property",
        price: "$325",
        duration: "Up to 3,500 sq ft",
        inclusions: [
          "Full interior coverage",
          "Daytime exterior (front + back)",
          "25+ edited photos",
          "MLS-ready exports + web-optimized set",
          "24-hour turnaround",
        ],
      },
      {
        name: "Airbnb Refresh",
        tagline: "Seasonal or post-renovation refresh for short-term rentals",
        price: "$275",
        duration: "Up to 2,500 sq ft",
        inclusions: [
          "Full interior coverage",
          "Lifestyle vignettes (coffee, towels, table settings)",
          "20+ edited photos",
          "Optimized for Airbnb / VRBO listings",
          "48-hour turnaround",
        ],
      },
      {
        name: "Bulk Listing Bundle",
        tagline: "For agents and PMs who need consistent turnaround",
        price: "$275",
        priceNote: "Per listing · minimum 4 listings/month",
        duration: "Up to 3,500 sq ft each",
        inclusions: [
          "Same-style editing across all listings",
          "Priority scheduling",
          "24-hour turnaround",
          "Single invoice + monthly billing",
        ],
      },
    ],
    addOns: [
      { name: "Twilight exterior add-on (single listing)", price: "$200" },
      { name: "Drone aerial shots", price: "$200" },
      { name: "Floor plan (2D)", price: "$125" },
      { name: "Property over 3,500 sq ft", price: "$75 per 1,000 sq ft" },
      { name: "Same-day rush turnaround", price: "$150" },
      { name: "Virtual staging (per room)", price: "$45" },
    ],
    pricingNote:
      "Agents shooting 4+ listings a month qualify for the Bulk Listing Bundle rate. Drone aerials are weather- and FAA-permitting.",
    faqs: [
      {
        question:
          "How much does real estate photography cost in Northern Virginia?",
        answer:
          "A standard single listing is $325 with 24-hour turnaround. The Listing + Twilight package is $525 and adds twilight exterior shots. For agents shooting 4+ listings a month, the Bulk Bundle drops the price to $275 per listing.",
      },
      {
        question:
          "How fast do you deliver listing photos?",
        answer:
          "Standard turnaround is 24 hours for all listing packages. If you need them faster, same-day rush delivery is available for $150. Airbnb Refresh photos are delivered within 48 hours.",
      },
      {
        question:
          "Do you offer drone photography for listings?",
        answer:
          "Yes — drone aerial shots are available as a $200 add-on for any listing package. Drone flights are weather- and FAA-permitting, but I'll work with your schedule to get them done as close to the interior shoot as possible.",
      },
      {
        question:
          "Do you photograph Airbnb and short-term rental properties?",
        answer:
          "I do. The Airbnb Refresh package ($275) is built for short-term rental hosts who need seasonal or post-renovation updates. It includes lifestyle vignettes — coffee setups, towel arrangements, table settings — optimized for Airbnb and VRBO listings.",
      },
    ],
  },

  // ==========================================================================
  // HIDDEN — preserved for future
  // ==========================================================================
  {
    slug: "modeling",
    umbrella: "portraits-pro",
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
    faqs: [
      {
        question:
          "How much does a model test shoot cost in the DC area?",
        answer:
          "Test shoots start at $500 for a 2-hour session with 2-3 looks and 30+ edited portfolio images. For a full editorial story with concept development, the Editorial package is $850 for a half-day shoot.",
      },
      {
        question:
          "Do you shoot agency digitals for model submissions?",
        answer:
          "I do. The Digitals package ($250 for 45 minutes) delivers clean, unretouched frames — full-length, 3/4, and headshot — on a neutral background with 24-hour turnaround. Agency-ready formats included.",
      },
      {
        question:
          "Can you help coordinate hair, makeup, and styling for a shoot?",
        answer:
          "Absolutely. I have HMUA referrals in the DMV area and I'm happy to coordinate with your existing team. Every session starts with a concept call so we're on the same page before anyone shows up on set.",
      },
    ],
  },
];
