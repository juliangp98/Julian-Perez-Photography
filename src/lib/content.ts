import {
  UMBRELLAS,
  type PortfolioCategory,
  type ServiceCategory,
  type SiteSettings,
} from "./types";
import { portfolioManifest } from "./portfolio-manifest";

// Site-wide settings. Edit here (or migrate to Sanity later).
export const siteSettings: SiteSettings = {
  siteName: "Julian Perez Photography",
  tagline: "Timeless moments from your best days, captured.",
  contactEmail: "juliangperez98@gmail.com",
  coverageArea: "Based in NOVA · Serving the DMV",
  bookingStatus: "Booking 2026–2027",
  bookingUrl:
    "https://book.squareup.com/appointments/av2zblbi8bxb7j/location/LM2BPYJFHR5QV/services",
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
      text: "Julian Perez did an amazing job with both my maternity and baby shower photography! He captured every special moment beautifully and made me feel so comfortable throughout the sessions. The photos came out stunning — natural, warm, and exactly what I had envisioned. Highly recommend him to anyone looking for a talented and professional photographer who truly cares about his work!",
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

// Service categories with pricing.
//
// Conventions:
//   - `description` is the short subtitle under the page title (same format
//     across every service page, muted color).
//   - `intro` is the long-form body copy. For weddings/engagements/graduation,
//     these paragraphs are Julian's original language; the final paragraph is
//     a short segue that leads into the packages grid.
//   - Packages are ordered most expensive → least expensive.
//   - Every entry is tagged with an `umbrella` so the nav and index pages can
//     group automatically.
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
  },
];

// Visible-only helpers — used by nav, listings, sitemap, generateStaticParams.
// Hidden categories stay in the source array so we don't lose the content,
// but they get excluded from anything indexable or user-facing.
export const visibleServices = services.filter((s) => !s.hidden);

// Portfolio galleries. Placeholder images until Julian exports originals from
// Adobe Portfolio and drops them into /public/portfolio/<slug>/.
export const portfolios: PortfolioCategory[] = [
  // Weddings & Couples
  {
    slug: "weddings",
    umbrella: "weddings-couples",
    title: "Weddings",
    description: "Full wedding days, from quiet prep to the last dance.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "engagements-couples",
    umbrella: "weddings-couples",
    title: "Engagements & Couples",
    description: "Engagements, anniversaries, and couples sessions.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Family & Life Events
  {
    slug: "maternity",
    umbrella: "family-life",
    title: "Maternity",
    description: "Patient, soft sessions to mark the wait.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "newborn",
    umbrella: "family-life",
    title: "Newborn & First Year",
    description: "In-home newborn sessions and first-year milestones.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "family-portraits",
    umbrella: "family-life",
    title: "Family Portraits",
    description: "Posed and candid family portrait sessions.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "family-celebrations",
    umbrella: "family-life",
    title: "Family Celebrations",
    description:
      "1st birthdays, baby showers, gender reveals, reunions, and milestone parties.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "pet",
    umbrella: "family-life",
    title: "Pet Photography",
    description: "In-home and outdoor portraits of the four-legged family.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "cultural-milestones",
    umbrella: "family-life",
    title: "Cultural Milestones",
    description: "Quinceañeras, Sweet 16s, Bar/Bat Mitzvahs, and more.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Personal & Pro Portraits
  {
    slug: "portraiture",
    umbrella: "portraits-pro",
    title: "Portraiture",
    description: "Individual portraits — guided and natural.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "graduation",
    umbrella: "portraits-pro",
    title: "Graduation",
    description: "Solo and group sessions across the DMV.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "corporate-headshots",
    umbrella: "portraits-pro",
    title: "Corporate Headshots",
    description: "Consistent, polished headshots for teams and individuals.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Brand & Events
  {
    slug: "corporate-community-events",
    umbrella: "brand-events",
    title: "Corporate & Community Events",
    description:
      "Conferences, galas, receptions, and community events.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "concerts-performances",
    umbrella: "brand-events",
    title: "Concerts & Performances",
    description:
      "Live concerts, band sets, recitals, and stage performances.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "brand-commercial",
    umbrella: "brand-events",
    title: "Brand & Commercial Content",
    description:
      "Studios, instructor portraits, product, and brand campaigns.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "real-estate",
    umbrella: "brand-events",
    title: "Real Estate & Airbnb",
    description: "Listing photos for agents and short-term rental hosts.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Hidden
  {
    slug: "modeling",
    umbrella: "portraits-pro",
    title: "Modeling",
    description: "Test shoots, portfolios, and editorial work.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
    hidden: true,
  },
];

// Splice in any imported gallery images from the auto-generated manifest.
// The manifest takes precedence over the placeholder values defined above
// so re-running `npm run import-photos` picks up new or removed images
// without touching this file. If a slug isn't in the manifest yet, it
// keeps the placeholder hero + empty gallery defined inline.
for (const p of portfolios) {
  const m = portfolioManifest[p.slug];
  if (m) {
    p.coverImage = m.coverImage;
    p.images = m.images;
  }
}

export const visiblePortfolios = portfolios.filter((p) => !p.hidden);

export function getService(slug: string) {
  const s = services.find((s) => s.slug === slug);
  return s && !s.hidden ? s : undefined;
}

export function getPortfolio(slug: string) {
  const p = portfolios.find((p) => p.slug === slug);
  return p && !p.hidden ? p : undefined;
}

// Group helpers for the nav and index pages.
export function servicesByUmbrella() {
  return UMBRELLAS.map((u) => ({
    ...u,
    items: visibleServices.filter((s) => s.umbrella === u.id),
  }));
}

export function portfoliosByUmbrella() {
  return UMBRELLAS.map((u) => ({
    ...u,
    items: visiblePortfolios.filter((p) => p.umbrella === u.id),
  }));
}
