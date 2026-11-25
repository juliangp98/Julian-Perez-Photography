// Discovery-call guides: what Julian reads from on a call with a prospect.
// One shared framework (before the call, the warm open, about me, investment,
// positioning, the close, after the call) wraps three sections that depend on
// the kind of shoot: getting to know them, the shoot or event itself, and
// their photography priorities. Services are grouped into families that share
// those three; a few services add, swap or drop a part of their own. A project
// with no service yet gets a general guide with no wedding or business words.
//
// Questions carry stable ids, unique within their section: the answers typed
// during a call are saved under "<section>.<question>" (client_records.calls),
// and the AI tailoring is built from the same structure. Pure data, so the
// admin's client components can read it.

import type { ServiceSlug } from "./types";

export type GuideQuestion = { id: string; ask: string };

export type GuideSection = {
  id: string;
  title: string;
  // Roughly how long it takes on the call.
  minutes?: string;
  // Talking points: things to say or do, with no answer to note.
  say?: string[];
  // Questions to ask, each with room for the answer.
  questions?: GuideQuestion[];
};

export type FamilyId =
  | "general"
  | "couples"
  | "celebrations"
  | "family"
  | "individual"
  | "business"
  | "live-events";

export type GuideFamily = {
  id: FamilyId;
  label: string;
  // The first line after the greeting.
  opener: string;
  // The "tie it back to them" line at the end of About me.
  tieIn: string;
  // The family's own sections: "people", "event" and "priorities".
  sections: GuideSection[];
};

export type DiscoveryGuide = {
  family: GuideFamily;
  sections: GuideSection[];
};

// ── The shared framework ──

const BEFORE: GuideSection = {
  id: "before",
  title: "Before the call",
  minutes: "2 min",
  say: [
    "Re-read their inquiry and jot down names, the date, the venue and anything they mentioned.",
    "Check the date is open (the date check above).",
    "Have your collections and one or two relevant galleries open.",
    "Quiet room, water, smile: they can hear it.",
  ],
};

// The warm open, ending on the family's opener or the service's own.
const openSection = (opener: string): GuideSection => ({
  id: "open",
  title: "Warm open",
  minutes: "1 to 2 min",
  say: [
    "Greet them by name and thank them for reaching out.",
    "Light agenda: \"I'd love to hear all about it, share a bit about how I work, and answer anything. Sound good?\"",
    opener,
  ],
});

const aboutSection = (family: GuideFamily): GuideSection => ({
  id: "about",
  title: "About me and how I work",
  minutes: "2 to 3 min, conversational",
  say: [
    "Who I am: [DMV-based, ___ years shooting, what drew me to this work].",
    "My style: [documentary candids with a few intentional portraits; true to color, film-inspired].",
    "On the day: calm, unobtrusive, happy to help keep things on schedule.",
    "Why clients pick me: [one or two honest differentiators].",
    family.tieIn,
  ],
});

// The collections are listed above the guide once the project has a service.
const investmentSection = (hasService: boolean): GuideSection => ({
  id: "investment",
  title: "Investment and expectations",
  minutes: "transparent, no pressure",
  questions: [{ id: "budget-range", ask: "Have you set a photography budget range?" }],
  say: [
    hasService
      ? "Walk through how the collections work (they're listed above)."
      : "Walk through how the collections work. Set the project's service to list them above.",
    "Deliverables and timing: number of images, sneak peeks, full-gallery turnaround.",
    "To book: a signed agreement and a retainer hold the date.",
  ],
});

const POSITION: GuideSection = {
  id: "position",
  title: "Position yourself",
  minutes: "woven through, and at the close",
  say: [
    "Connect a strength to their plans: \"I shoot a lot of [venue / style], here's a gallery.\"",
    "Share one or two relevant galleries and a recent review.",
    "Reassure them on whatever they said was stressing them.",
    "Differentiators: [local DMV knowledge, calm and organized, help with the timeline, fast delivery, photo and film from one team].",
  ],
};

const CLOSE: GuideSection = {
  id: "close",
  title: "Close and next steps",
  say: [
    "\"From everything you've shared, I think we'd be a great fit because [specific].\"",
    "Concrete next step: \"I'll send your proposal and a full gallery today. Your date's open, and I can hold it for you for [X days], no obligation.\"",
    "Thank them warmly.",
  ],
  questions: [{ id: "their-questions", ask: "What questions do you have for me?" }],
};

const AFTER: GuideSection = {
  id: "after",
  title: "After the call",
  minutes: "within a few hours",
  say: [
    "Summarize the call below, then write the recap and proposal email from it.",
    "Recap: lovely to meet you, their vision in their words, the proposal and a gallery, the date hold and the retainer.",
    "Sending the recap sets a follow-up for when they haven't replied.",
  ],
};

// ── The families ──

// Before the service is known.
const GENERAL: GuideFamily = {
  id: "general",
  label: "Discovery",
  opener: "Easy opener: \"First, tell me what you have in mind. What has you thinking about photos right now?\"",
  tieIn: "Tie it back to them: \"...which suits the [occasion / feel] you described.\"",
  sections: [
    {
      id: "people",
      title: "Get to know them",
      minutes: "the heart of the call",
      questions: [
        { id: "occasion", ask: "What's the occasion, and who is it for?" },
        { id: "who-in-photos", ask: "Who would be in the photos?" },
        { id: "in-a-few-words", ask: "How would you describe them, in a few words?" },
        { id: "looking-forward", ask: "What are you most looking forward to?" },
        { id: "stressing", ask: "What's stressing you most right now?" },
        { id: "past-photos", ask: "Any past photos you've loved, or hated, and why?" },
        { id: "camera-comfort", ask: "Camera-shy, or comfortable in front of the lens?" },
      ],
    },
    {
      id: "event",
      title: "About the shoot",
      minutes: "logistics and vision",
      questions: [
        { id: "date", ask: "Do you have a date in mind, or a window?" },
        { id: "location", ask: "Where are you picturing it: at an event, at home, outdoors, in a studio?" },
        { id: "guest-count", ask: "If it's an event, roughly how many people?" },
        { id: "timeline", ask: "What's the rough timeline, start to finish?" },
        { id: "must-haves", ask: "Any must-have shots, people or moments?" },
        { id: "vibe", ask: "What's the vibe, in three words?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photos-for", ask: "Afterwards, what do the photos do for you: prints, social, a website, the memories?" },
        { id: "style", ask: "What style do you lean toward: light and airy, true to color, moody, lots of black and white?" },
        { id: "coverage", ask: "How much time feels right?" },
        { id: "needed-by", ask: "Do you need the photos by a certain date?" },
        { id: "prints", ask: "Are prints, albums or wall art important to you?" },
      ],
    },
  ],
};

const COUPLES: GuideFamily = {
  id: "couples",
  label: "Couples",
  opener: "Easy opener: \"First, congratulations! How's the planning feeling so far?\"",
  tieIn: "Tie it back to them: \"...which suits the [intimate / outdoor / big-celebration] feel you described.\"",
  sections: [
    {
      id: "people",
      title: "Get to know the couple",
      minutes: "the heart of the call",
      questions: [
        { id: "how-met", ask: "How did you two meet? How long have you been together?" },
        { id: "proposal", ask: "Tell me about the proposal." },
        { id: "describe-each-other", ask: "How would you each describe the other in a few words?" },
        { id: "most-excited", ask: "What are you most excited about for the day?" },
        { id: "stressing", ask: "What's stressing you most right now?" },
        { id: "past-photos", ask: "Any past weddings where you loved, or hated, how the photos were handled?" },
        { id: "camera-comfort", ask: "Camera-shy, or comfortable in front of the lens?" },
      ],
    },
    {
      id: "event",
      title: "About the wedding",
      minutes: "logistics and vision",
      questions: [
        { id: "date-flexible", ask: "Is the date locked, or flexible?" },
        { id: "venues", ask: "Are the ceremony and reception in the same place?" },
        { id: "guest-count", ask: "How many guests: intimate or large?" },
        { id: "timeline", ask: "What's the rough timeline: getting ready, ceremony, reception, send-off?" },
        { id: "traditions", ask: "Any cultural, religious or family traditions to capture?" },
        { id: "party-family", ask: "How big is the wedding party? Any family dynamics to be sensitive to?" },
        { id: "vendors", ask: "Which vendors are booked: planner, videographer, DJ?" },
        { id: "first-look", ask: "First look, or saving it for the aisle?" },
        { id: "must-haves", ask: "Any must-have shots, people or heirlooms?" },
        { id: "vibe", ask: "What's the vibe, in three words?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photos-for", ask: "After the day, what do the photos do for you: albums, prints, social, the memories?" },
        { id: "style", ask: "What style do you lean toward: light and airy, true to color, moody, film-like, lots of black and white?" },
        { id: "coverage", ask: "How many hours of coverage feels right? Getting ready through send-off?" },
        { id: "second-shooter", ask: "Are you interested in a second shooter?" },
        { id: "engagement", ask: "Would an engagement session appeal to you?" },
        { id: "film", ask: "Any interest in a wedding film alongside the photos?" },
        { id: "albums", ask: "Are albums, prints or wall art important to you?" },
      ],
    },
  ],
};

const CELEBRATIONS: GuideFamily = {
  id: "celebrations",
  label: "Celebrations",
  opener: "Easy opener: \"First, congratulations on the milestone! How's the planning feeling so far?\"",
  tieIn: "Tie it back to them: \"...which suits the [intimate family party / traditional ceremony and reception / big multi-generation gathering] you described.\"",
  sections: [
    {
      id: "people",
      title: "Get to know the honoree and the family",
      minutes: "the heart of the call",
      questions: [
        { id: "guest-of-honor", ask: "How would you describe the guest of honor in a few words?" },
        { id: "milestone-meaning", ask: "What does this milestone mean to your family?" },
        { id: "looking-forward", ask: "What's everyone most looking forward to about the day?" },
        { id: "biggest-stress", ask: "What's stressing you most right now?" },
        { id: "vips", ask: "Who are the VIPs I should know by name: grandparents, godparents, padrinos?" },
        { id: "court-size", ask: "If there's a court, how many damas and chambelanes are in it?" },
        { id: "family-dynamics", ask: "Any family dynamics I should be sensitive to?" },
        { id: "camera-comfort", ask: "Is the guest of honor camera-shy, or a natural in front of the lens?" },
        { id: "past-photos", ask: "Any past family events where you loved, or hated, how the photos turned out?" },
      ],
    },
    {
      id: "event",
      title: "About the celebration",
      minutes: "logistics and vision",
      questions: [
        { id: "date-flexibility", ask: "Is your date locked in, or still flexible?" },
        { id: "venues", ask: "Is everything at one venue, or are there a few locations?" },
        { id: "guest-count", ask: "Roughly how many guests are you expecting?" },
        { id: "timeline", ask: "Can you walk me through the rough timeline, start to finish?" },
        { id: "service-photo-rules", ask: "If there's a religious service, does the church or synagogue have photo rules?" },
        { id: "traditions", ask: "Which traditions are part of the day, like the waltz, a candle lighting or the hora?" },
        { id: "surprises", ask: "Any surprises planned, like a choreographed dance, a reveal or a slideshow?" },
        { id: "languages", ask: "Will the day be in English, Spanish, Hebrew, or a mix?" },
        { id: "vendors", ask: "Which vendors have you booked so far: planner, DJ, videographer?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photo-use", ask: "After the day, what do the photos do for you: the family group chat, social, the memories?" },
        { id: "must-have-moments", ask: "Which three moments absolutely can't be missed?" },
        { id: "family-portraits", ask: "Which family groupings matter most for the formal portraits?" },
        { id: "coverage", ask: "How much coverage feels right: just the party, or from setup and getting ready through the last dance?" },
        { id: "pre-event-portraits", ask: "For a quinceañera, Sweet 16, mitzvah or debut, would a portrait session in the dress or suit, before the day, appeal to you?" },
        { id: "second-shooter", ask: "With your guest count, would a second shooter be helpful?" },
        { id: "social-selects", ask: "Would a few same-day photos to post during the party be useful?" },
        { id: "style", ask: "What style do you lean toward: true-to-color, bright and airy, moody, lots of black and white?" },
        { id: "albums-prints", ask: "Are albums, prints or wall art important to you?" },
      ],
    },
  ],
};

const FAMILY: GuideFamily = {
  id: "family",
  label: "Family",
  opener: "Easy opener: \"First, how's everyone at home doing? What has you thinking about photos right now?\"",
  tieIn: "Tie it back to them: \"...and I work at your family's pace, which suits the [quiet at-home / golden-hour outdoor / playful and candid] session you described.\"",
  sections: [
    {
      id: "people",
      title: "Get to know the family",
      minutes: "the heart of the call",
      questions: [
        { id: "who-in-photos", ask: "Who would be in the photos, pets included?" },
        { id: "due-date", ask: "For maternity or a newborn, when is the baby due, or when were they born?" },
        { id: "kids-ages", ask: "If there are kids, how old are they?" },
        { id: "personalities", ask: "How would you describe each of them in a few words?" },
        { id: "temperament", ask: "How do the kids or pets usually do with someone new?" },
        { id: "camera-shy", ask: "Anyone camera-shy, or is everyone comfortable in front of the lens?" },
        { id: "this-stage", ask: "What about this stage of life do you most want to remember?" },
        { id: "past-photos", ask: "Any past family photos you loved, or hated?" },
        { id: "worries", ask: "What's stressing you most about the session right now?" },
      ],
    },
    {
      id: "event",
      title: "About the session",
      minutes: "logistics and vision",
      questions: [
        { id: "date-window", ask: "Do you have a date in mind, or a window?" },
        { id: "weeks-along", ask: "For maternity, how far along will you be around then?" },
        { id: "home-or-location", ask: "Are you thinking at home, outdoors, or in a studio?" },
        { id: "location-ideas", ask: "Any favorite spots you've been thinking about?" },
        { id: "time-of-day", ask: "Golden hour, or does another time of day work better?" },
        { id: "naps-and-feeding", ask: "With a little one, what do naps and feedings look like, so we can plan around them?" },
        { id: "comfort-pacing", ask: "Anything about comfort, mobility, or pacing I should plan around?" },
        { id: "wardrobe-help", ask: "Would you like help with outfits and styling?" },
        { id: "heirlooms", ask: "Any heirlooms or meaningful items you'd like included?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photo-use", ask: "After the session, what do the photos do for you: holiday cards, social, the memories?" },
        { id: "posed-or-candid", ask: "Posed and polished, candid, or a mix of both?" },
        { id: "editing-style", ask: "Style preference: light and airy, true-to-color, moody, or lots of black and white?" },
        { id: "must-have-shots", ask: "Any must-have shots, like the kids with their grandparents?" },
        { id: "session-length", ask: "How much time feels right, given everyone's energy?" },
        { id: "needed-by", ask: "Do you need the photos by a certain date, like for holiday cards?" },
        { id: "first-year-series", ask: "With a new baby, would a series across their first year appeal to you?" },
        { id: "prints-albums", ask: "Are prints, albums, or wall art important to you?" },
        { id: "sharing-limits", ask: "Anyone who'd rather not appear on social media?" },
      ],
    },
  ],
};

const INDIVIDUAL: GuideFamily = {
  id: "individual",
  label: "Individual",
  opener: "Easy opener: \"First, what's the occasion: a milestone, a new project, or just time for photos you actually love?\"",
  tieIn: "Tie it back to them: \"...which suits the [personal branding / portfolio / cap-and-gown] photos you described, even if you're [camera-shy / new to posing].\"",
  sections: [
    {
      id: "people",
      title: "Get to know them",
      minutes: "the heart of the call",
      questions: [
        { id: "what-you-do", ask: "What do you do, or what are you studying?" },
        { id: "whats-next", ask: "What's coming up next for you?" },
        { id: "in-a-few-words", ask: "How would the people closest to you describe you in a few words?" },
        { id: "proud-of", ask: "What are you proudest of right now?" },
        { id: "agency-status", ask: "If you're modeling, are you with an agency, or building your book on your own?" },
        { id: "camera-comfort", ask: "Are you camera-shy, or comfortable in front of the lens?" },
        { id: "past-photos", ask: "Any photos of yourself you've loved, or hated, and why?" },
        { id: "plan-around", ask: "Anything I should plan around, like pacing or accessibility?" },
      ],
    },
    {
      id: "event",
      title: "About the shoot",
      minutes: "logistics and vision",
      questions: [
        { id: "date-or-deadline", ask: "Any date or deadline we're working toward, like commencement or a launch?" },
        { id: "studio-or-outdoor", ask: "Are you picturing studio, outdoors, or a mix?" },
        { id: "meaningful-spots", ask: "Any spots that mean something to you, like a favorite park or neighborhood?" },
        { id: "permit-locations", ask: "Any spots on your list that might need a permit, like campus or the monuments?" },
        { id: "outfit-changes", ask: "How many outfits or looks are you picturing?" },
        { id: "cap-and-gown", ask: "For a graduation, will your cap, gown, and stoles be ready by the session?" },
        { id: "who-is-joining", ask: "Is anyone joining you, like fellow grads or family?" },
        { id: "hair-makeup", ask: "Do you have hair and makeup covered, or would a referral help?" },
        { id: "vibe", ask: "What's the vibe you're going for, in three words?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photo-purpose", ask: "What do you want these photos to do for you?" },
        { id: "where-used", ask: "Where will the photos live: your website, LinkedIn, social, or agency submissions?" },
        { id: "references", ask: "Any references or saved photos you'd like me to see?" },
        { id: "style", ask: "What style are you drawn to: bright and airy, true-to-color, moody, or editorial?" },
        { id: "concept", ask: "Do you have a concept in mind, or should we build one together?" },
        { id: "retouching-level", ask: "How polished do you want the edits: natural, or fully retouched?" },
        { id: "session-length", ask: "How much time feels right: a quick session, or room to explore?" },
        { id: "turnaround", ask: "How soon do you need the photos back?" },
        { id: "prints", ask: "Are prints or wall art important to you?" },
      ],
    },
  ],
};

const BUSINESS: GuideFamily = {
  id: "business",
  label: "Business",
  opener: "Easy opener: \"First, how's business been lately? What's got you looking for new photos right now?\"",
  tieIn: "Tie it back to them: \"...which suits the [consistent team look / product launch / steady listing schedule] you described.\"",
  sections: [
    {
      id: "people",
      title: "Get to know the business",
      minutes: "the heart of the call",
      questions: [
        { id: "business-overview", ask: "How would you describe what you do, in a sentence or two?" },
        { id: "target-customer", ask: "Who's the customer you most want these photos to reach?" },
        { id: "brand-personality", ask: "What three words sum up the brand's personality?" },
        { id: "decision-maker", ask: "Who makes the final call on booking?" },
        { id: "sign-off", ask: "Who signs off on the images before they go out?" },
        { id: "project-stress", ask: "What's stressing you most about this project right now?" },
        { id: "past-shoots", ask: "Any past shoots where you loved, or hated, how the photos turned out?" },
        { id: "camera-comfort", ask: "Are you and the team comfortable on camera, or is anyone camera-shy?" },
      ],
    },
    {
      id: "event",
      title: "About the shoot",
      minutes: "logistics and vision",
      questions: [
        { id: "shoot-type", ask: "What are we shooting: headshots, a class, products, or a property?" },
        { id: "volume", ask: "Roughly how many people, products, or listings?" },
        { id: "property-size", ask: "For a property, roughly how many square feet?" },
        { id: "shoot-date", ask: "Is the shoot date locked, or flexible?" },
        { id: "deadline", ask: "Is a hard deadline driving this, like a launch or a listing going live?" },
        { id: "location", ask: "Are we shooting at your space, or would a studio suit you better?" },
        { id: "access", ask: "Anything I should know about access, like parking, security, or a lockbox?" },
        { id: "team-scheduling", ask: "For a team, would booked time slots or drop-ins work better?" },
        { id: "space-prep", ask: "Will the space be cleaned and staged before I arrive?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "end-use", ask: "Where will these images live: website, LinkedIn, social, listings, or print?" },
        { id: "usage-rights", ask: "Will anyone outside your business use these images, like partners or the press?" },
        { id: "brand-guidelines", ask: "Any brand guidelines or reference images I should study?" },
        { id: "background", ask: "Which backgrounds fit: clean and neutral, brand colors, or your own space?" },
        { id: "retouching", ask: "How much retouching feels right: natural, polished, or a magazine finish?" },
        { id: "match-existing", ask: "Do these need to match photos you already have?" },
        { id: "social-extras", ask: "Any interest in same-day social selects or short reels?" },
        { id: "listing-extras", ask: "For a listing, would twilight, drone, or a floor plan help?" },
        { id: "recurring", ask: "Is this a one-off, or something you'd want on a regular schedule?" },
      ],
    },
  ],
};

const LIVE_EVENTS: GuideFamily = {
  id: "live-events",
  label: "Live events",
  opener: "Easy opener: \"First, this sounds like a great event. How's the planning coming along so far?\"",
  tieIn: "Tie it back to them: \"...which suits the [conference / gala / concert / recital] you described, where the big moments only happen once.\"",
  sections: [
    {
      id: "people",
      title: "Get to know the team and the people on stage",
      minutes: "the heart of the call",
      questions: [
        { id: "your-role", ask: "What's your role in all this: organizer, marketing, the artist's team?" },
        { id: "organization", ask: "Who's putting this on: a company, a nonprofit, a band, a school?" },
        { id: "audience", ask: "Who's the crowd: members, clients, residents, fans, families?" },
        { id: "key-people", ask: "Who are the people I can't miss: speakers, honorees, VIPs, performers?" },
        { id: "decision-maker", ask: "Who else has a say in booking: a boss, a committee, a manager?" },
        { id: "on-site-contact", ask: "Who'll be my point of contact on the day: you, a coordinator, a stage manager?" },
        { id: "photo-approval", ask: "Does anyone need to approve photos before they're posted?" },
        { id: "opt-outs", ask: "Anyone attending who'd rather not be photographed?" },
        { id: "biggest-worry", ask: "What's stressing you most about the event right now?" },
      ],
    },
    {
      id: "event",
      title: "About the event",
      minutes: "logistics and vision",
      questions: [
        { id: "single-or-multi-day", ask: "Is it a single day or night, or does it run across several?" },
        { id: "venue", ask: "Where's it happening: one room, or moving between spaces?" },
        { id: "run-of-show", ask: "Is there a run of show or set schedule you can share?" },
        { id: "attendance", ask: "Roughly how many people are you expecting?" },
        { id: "access", ask: "What access will I have: backstage, soundcheck, rehearsal?" },
        { id: "restrictions", ask: "Any restrictions, like a three-song rule, no flash, or off-limits areas?" },
        { id: "lighting", ask: "What's the light like: stage lighting, a dim ballroom, daylight?" },
        { id: "credentials", ask: "Will I need press credentials or clearance to get in?" },
        { id: "recurring", ask: "Is this a one-off, or does it happen every month or quarter?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photo-use", ask: "After the event, where do the photos go: social, press, your website, a sponsor recap?" },
        { id: "must-have-shots", ask: "Any must-have shots, like the keynote, sponsor signage, or the encore?" },
        { id: "candid-or-posed", ask: "Are you after more candids and crowd energy, or more posed group shots?" },
        { id: "past-coverage", ask: "Any past event photos you loved, or ones that missed the mark?" },
        { id: "coverage-hours", ask: "How many hours of coverage feels right: the key moments, or start to finish?" },
        { id: "same-day-selects", ask: "Would same-day selects help your team post while it's still going?" },
        { id: "gallery-turnaround", ask: "When do you need the full gallery in hand?" },
        { id: "second-shooter", ask: "Interested in a second shooter for a big room or parallel sessions?" },
        { id: "add-ons", ask: "Any interest in vertical reels, a branded photo-booth corner, or video alongside stills?" },
      ],
    },
  ],
};

const FAMILIES: Record<FamilyId, GuideFamily> = {
  general: GENERAL,
  couples: COUPLES,
  celebrations: CELEBRATIONS,
  family: FAMILY,
  individual: INDIVIDUAL,
  business: BUSINESS,
  "live-events": LIVE_EVENTS,
};

// Which family each service's call follows.
export const SERVICE_FAMILY: Record<ServiceSlug, FamilyId> = {
  weddings: "couples",
  "wedding-films": "couples",
  "engagements-couples": "couples",
  "cultural-milestones": "celebrations",
  "family-celebrations": "celebrations",
  maternity: "family",
  newborn: "family",
  "family-portraits": "family",
  pet: "family",
  portraiture: "individual",
  graduation: "individual",
  modeling: "individual",
  "corporate-headshots": "business",
  "brand-commercial": "business",
  "real-estate": "business",
  "corporate-community-events": "live-events",
  "concerts-performances": "live-events",
};

// Sections a service adds to, or swaps into, its family's: by section id, a
// swap replaces the family's section with that id, and a new id is added
// after the priorities.
const SERVICE_SECTIONS: Partial<Record<ServiceSlug, GuideSection[]>> = {
  "wedding-films": [
    {
      id: "film",
      title: "About the film",
      questions: [
        { id: "lead", ask: "Do you picture the film or the photos leading, with the other alongside?" },
        { id: "length", ask: "How long would you like the highlight film to be?" },
        { id: "audio", ask: "Which moments need clean audio: vows, letters, speeches?" },
        { id: "drone", ask: "Would aerial shots of the venue add something, if it allows a drone?" },
        { id: "raw-footage", ask: "Would you want the full ceremony and speeches as well as the highlight film?" },
        { id: "watch", ask: "Where will you watch and share it: at home, with family, online?" },
      ],
    },
  ],
  "engagements-couples": [
    {
      id: "people",
      title: "Get to know the two of you",
      minutes: "the heart of the call",
      questions: [
        { id: "how-met", ask: "How did you two meet? How long have you been together?" },
        { id: "describe-each-other", ask: "How would you each describe the other in a few words? If it's a surprise, tell me about them." },
        { id: "this-season", ask: "What does this season of your relationship look like right now?" },
        { id: "surprise-partner", ask: "If it's a surprise proposal, what would your partner love, and what would they hate?" },
        { id: "camera-comfort", ask: "Camera-shy, or comfortable in front of the lens?" },
        { id: "past-photos", ask: "Any photos of the two of you that you've loved, or hated, and why?" },
      ],
    },
    {
      id: "priorities",
      title: "Their photography priorities",
      questions: [
        { id: "photos-for", ask: "What will the photos do for you: save-the-dates, a wedding website, prints, the memories?" },
        { id: "style", ask: "What style do you lean toward: light and airy, true to color, moody, film-like, lots of black and white?" },
        { id: "session-length", ask: "How much time feels right: a quick session, or room to explore a couple of spots?" },
        { id: "image-count", ask: "Roughly how many edited images are you hoping for?" },
        { id: "wedding-coverage", ask: "If there's a wedding coming, would you like to talk about coverage for the day too?" },
        { id: "albums", ask: "Are prints, an album or wall art important to you?" },
      ],
    },
    {
      id: "event",
      title: "About the session",
      minutes: "logistics and vision",
      questions: [
        { id: "occasion", ask: "What's the occasion: an engagement, an anniversary, a proposal, or just the two of you?" },
        { id: "wedding-date", ask: "If there's a wedding coming up, when is it, and will the photos be used for it?" },
        { id: "location", ask: "Any places that mean something to you, or a look you're picturing?" },
        { id: "time-of-day", ask: "Golden hour, blue hour, or another time of day?" },
        { id: "outfits", ask: "How many outfits are you thinking, and would styling help be useful?" },
        { id: "extras", ask: "Anyone or anything joining you: a pet, a ring, a favorite spot?" },
        { id: "proposal-plan", ask: "If it's a surprise proposal, how is it planned, and who knows?" },
      ],
    },
  ],
};

// Openers a service uses in place of its family's: ones the family's would
// assume wrongly.
const SERVICE_OPENERS: Partial<Record<ServiceSlug, string>> = {
  // Not every couples session is an engagement, or a wedding being planned.
  "engagements-couples":
    "Easy opener: \"First, tell me a bit about the two of you. What has you thinking about photos right now?\"",
};

// Questions a service leaves out of its family's sections, by answer key: ones
// its own sections already cover.
const SERVICE_DROPS: Partial<Record<ServiceSlug, string[]>> = {
  // The film section asks how film and photos fit together.
  "wedding-films": ["priorities.film"],
};

// A service slug the catalog knows: the stored service is free text (an
// inquiry can carry any), so a lookup never reads an inherited key.
const knownService = (serviceType?: string): ServiceSlug | undefined =>
  serviceType && Object.hasOwn(SERVICE_FAMILY, serviceType) ? (serviceType as ServiceSlug) : undefined;

export function guideFamily(serviceType?: string): GuideFamily {
  const slug = knownService(serviceType);
  return slug ? FAMILIES[SERVICE_FAMILY[slug]] : FAMILIES.general;
}

// The whole guide for a service, in call order.
export function discoveryGuide(serviceType?: string): DiscoveryGuide {
  const slug = knownService(serviceType);
  const family = guideFamily(serviceType);
  const own = (slug && SERVICE_SECTIONS[slug]) || [];
  const drops = new Set((slug && SERVICE_DROPS[slug]) || []);
  const middle = family.sections
    .map((s) => own.find((o) => o.id === s.id) ?? s)
    .map((s) => ({ ...s, questions: s.questions?.filter((q) => !drops.has(answerKey(s, q))) }));
  const added = own.filter((o) => !family.sections.some((s) => s.id === o.id));
  return {
    family,
    sections: [
      BEFORE,
      openSection((slug && SERVICE_OPENERS[slug]) || family.opener),
      aboutSection(family),
      ...middle,
      ...added,
      investmentSection(!!slug),
      POSITION,
      CLOSE,
      AFTER,
    ],
  };
}

// The key a question's answer is saved under.
export function answerKey(section: GuideSection, question: GuideQuestion): string {
  return `${section.id}.${question.id}`;
}

// The key an answer to one of the AI's tailored questions is saved under:
// made from the question itself (a short FNV-1a hash), so tailoring again
// never moves an answer onto a different question.
export function tailoredKey(ask: string): string {
  let hash = 0x811c9dc5;
  for (const ch of ask.trim()) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `tailored.${hash.toString(16).padStart(8, "0")}`;
}

// Every question in a guide, with its answer key and section.
export function guideQuestions(
  guide: DiscoveryGuide,
): { key: string; section: GuideSection; question: GuideQuestion }[] {
  return guide.sections.flatMap((section) =>
    (section.questions ?? []).map((question) => ({
      key: answerKey(section, question),
      section,
      question,
    })),
  );
}
