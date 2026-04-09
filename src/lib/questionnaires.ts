// Planning questionnaires for booked clients (and serious prospects).
//
// Each questionnaire is a schema that the QuestionnaireForm component renders
// dynamically. To add a new questionnaire, add an entry to QUESTIONNAIRES below
// keyed by ServiceSlug. The form, the index page, the service-page CTA, and
// the API validator all derive from this file — no other edits required.

import type { ServiceSlug } from "./types";
import { services } from "./content";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "date"
  | "time"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "package"; // auto-populated from the service's packages

// Conditional visibility clause used by both fields and sections. Lets a
// question or an entire section appear/disappear based on the value of another
// field — most commonly the booked package, so the form can scale to scope
// (e.g. hide the Reception section when an elopement Mini is selected).
//
//   equals       — show when parent value === this string
//   equalsAny    — show when parent value matches any of these strings
//   notEquals    — show when parent has been answered AND value !== this
//   notEqualsAny — show when parent has been answered AND value ∉ list
//
// `equals`/`equalsAny` default to HIDDEN until the parent is answered.
// `notEquals`/`notEqualsAny` default to VISIBLE when the parent is unset, so
// scope-narrowing rules don't accidentally hide everything before the user
// picks a package.
export type ShowIfClause = {
  id: string;
  equals?: string;
  equalsAny?: string[];
  notEquals?: string;
  notEqualsAny?: string[];
};

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[]; // for select / radio / checkbox
  showIf?: ShowIfClause;
};

export type Section = {
  title: string;
  description?: string;
  fields: Field[];
  showIf?: ShowIfClause;
};

export type Questionnaire = {
  slug: ServiceSlug;
  title: string;
  intro: string;
  audience: string; // who this is for ("booked clients" / "serious prospects")
  estimatedMinutes: number;
  sections: Section[];
};

// ----------------------------------------------------------------------------
// Shared building blocks
// ----------------------------------------------------------------------------

const YES_NO = ["Yes", "No", "Not sure yet"];

// Every questionnaire starts with the same "your details" section. Service
// schemas spread this in as their first section so we don't repeat the
// boilerplate fields in every questionnaire.
const yourDetailsSection: Section = {
  title: "Your details",
  description: "So I know who I'm talking to and how to reach you.",
  fields: [
    {
      id: "fullName",
      label: "Your full name",
      type: "text",
      required: true,
    },
    {
      id: "email",
      label: "Email address",
      type: "email",
      required: true,
    },
    {
      id: "phone",
      label: "Phone number",
      type: "tel",
      required: true,
      help: "Best number for day-of and last-minute coordination.",
    },
    {
      id: "instagram",
      label: "Instagram handle (optional)",
      type: "text",
      placeholder: "@yourhandle",
      help: "I love connecting with my clients — totally optional.",
    },
  ],
};

// Booking-status section — branches the form's tone. Every questionnaire uses
// this as the second section.
function bookingStatusSection(slug: ServiceSlug): Section {
  return {
    title: "Booking status",
    description:
      "This questionnaire is built for clients who have already booked, but I welcome serious prospects too — your answers help me give you a more accurate quote.",
    fields: [
      {
        id: "bookingStatus",
        label: "Are you already booked, or still exploring?",
        type: "radio",
        required: true,
        options: [
          "I'm already booked — let's plan",
          "I'm strongly considering and want a tailored quote",
        ],
      },
      {
        id: "package",
        label: "Which package are you booked into (or interested in)?",
        type: "package", // resolved at render-time from services[slug].packages
        required: true,
        // The "package" field type is resolved by the renderer using this slug.
        // We stash it here so the form knows which service to look up.
        help: `If you're not sure yet, pick "Still deciding" and we'll talk it through.`,
      },
      {
        id: "eventDate",
        label: "Date of your event / session",
        type: "date",
        required: true,
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// Wedding questionnaire — the comprehensive one
// ----------------------------------------------------------------------------

const weddingQuestionnaire: Questionnaire = {
  slug: "weddings",
  title: "Wedding planning questionnaire",
  intro:
    "Welcome! This is the questionnaire I send to every booked wedding couple — it's how I learn your day inside and out so I can show up prepared and stress-free. Take your time. You can save your answers and come back later.",
  audience: "Booked wedding couples (and serious prospects)",
  estimatedMinutes: 20,
  sections: [
    yourDetailsSection,
    {
      title: "About the two of you",
      fields: [
        {
          id: "partnerFullName",
          label: "Your partner's full name",
          type: "text",
          required: true,
        },
        {
          id: "partnerPronouns",
          label: "Pronouns (yours and your partner's, optional)",
          type: "text",
          placeholder: "e.g. she/her & they/them",
        },
      ],
    },
    bookingStatusSection("weddings"),
    {
      title: "Ceremony",
      description:
        "Every package includes the ceremony — even an elopement Mini.",
      fields: [
        {
          id: "ceremonyVenue",
          label: "Ceremony venue name and full address",
          type: "textarea",
          required: true,
        },
        {
          id: "ceremonyIndoorOutdoor",
          label: "Will the ceremony be indoor or outdoor?",
          type: "radio",
          required: true,
          options: ["Indoor", "Outdoor", "Both", "Tented / covered outdoor"],
        },
        {
          id: "ceremonyStartTime",
          label: "Ceremony start time",
          type: "time",
          required: true,
        },
        {
          id: "ceremonyLength",
          label: "Expected ceremony length",
          type: "text",
          required: true,
          placeholder: "e.g. 30 minutes, 1 hour",
        },
        {
          id: "ceremonyRestrictions",
          label: "Any photography restrictions during the ceremony?",
          type: "textarea",
          required: true,
          placeholder:
            "e.g. no flash, photographer must stay in back, no photos during certain religious moments — write 'none' if there are none.",
        },
      ],
    },
    {
      title: "Reception",
      description:
        "Skip this section if you booked the Mini package — it's ceremony + portraits only.",
      showIf: { id: "package", notEquals: "Mini" },
      fields: [
        {
          id: "receptionVenue",
          label: "Reception venue name and full address",
          type: "textarea",
          required: true,
          help: "Same as ceremony? Just write 'same as ceremony'.",
        },
        {
          id: "guestCount",
          label: "Approximate guest count",
          type: "number",
          required: true,
        },
        {
          id: "specialEntrance",
          label: "Will you have an announced or special entrance?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "specialDances",
          label: "Special dances planned",
          type: "checkbox",
          options: [
            "First dance",
            "Parent dance(s)",
            "Anniversary dance",
            "Group / cultural dance",
            "Choreographed routine",
            "None",
          ],
        },
        {
          id: "speeches",
          label: "Will there be speeches or toasts?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "cakeCutting",
          label: "Will there be a cake cutting?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "sunsetPortraits",
          label:
            "Want me to steal you both away for 5–10 minutes of golden-hour / sunset portraits during the reception?",
          type: "radio",
          required: true,
          options: ["Yes, please", "No thanks", "Up to you / surprise me"],
          help: "This is almost always a highlight of the gallery — I highly recommend it.",
        },
        {
          id: "formalExit",
          label:
            "Are you doing a formal exit (sparklers, glow sticks, bubbles, getaway car, etc.)?",
          type: "textarea",
          required: true,
          placeholder: "Describe it, or write 'no formal exit'.",
        },
        {
          id: "additionalReception",
          label:
            "Anything else happening at the reception I should know about?",
          type: "textarea",
          placeholder:
            "Surprise performance, photo booth, late-night snack, choreographed flash mob, tradition I might miss…",
        },
        {
          id: "vendorMeals",
          label: "Will vendors (including me) be provided a meal?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "I'm happy either way — I just plan my breaks differently.",
        },
      ],
    },
    {
      title: "Getting ready",
      description:
        "Coverage of prep, hair, makeup, and the small moments before the ceremony. Skipped automatically for elopement Mini packages.",
      showIf: { id: "package", notEquals: "Mini" },
      fields: [
        {
          id: "gettingReady",
          label: "Would you like getting-ready coverage?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "gettingReadyAddress",
          label: "Address of your get-ready location",
          type: "textarea",
          showIf: { id: "gettingReady", equals: "Yes" },
        },
        {
          id: "partnerGettingReady",
          label: "Would you like coverage of your partner getting ready?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "Silver, Premium, and Platinum include a second shooter — this is the ideal use of them. Essentials is solo unless you've added a second shooter.",
          showIf: { id: "package", notEquals: "Essentials" },
        },
        {
          id: "partnerGettingReadyAddress",
          label: "Address of your partner's get-ready location",
          type: "textarea",
          showIf: { id: "partnerGettingReady", equals: "Yes" },
        },
        {
          id: "essentialsSecondShooter",
          label:
            "Are you adding the second-shooter add-on to your Essentials package?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "Essentials is solo by default; second shooter is a $400 add-on. Lets me know whether to plan for partner getting-ready coverage.",
          showIf: { id: "package", equals: "Essentials" },
        },
        {
          id: "firstLook",
          label: "Are you having a first look, first touch, or neither?",
          type: "radio",
          required: true,
          options: [
            "First look (with each other)",
            "First touch (no eye contact)",
            "First look with parent / family member",
            "First look with bridal party",
            "No first look — we want to see each other at the aisle",
            "Still deciding",
          ],
        },
        {
          id: "firstLookWith",
          label: "If a first look with someone other than your partner, with whom?",
          type: "text",
          placeholder: "e.g. dad, mom, both parents, sister",
        },
      ],
    },
    {
      title: "Wedding party & details",
      description:
        "Skipped automatically for the elopement Mini package — we'll catch up on details day-of.",
      showIf: { id: "package", notEquals: "Mini" },
      fields: [
        {
          id: "weddingParty",
          label: "Wedding party — how many on each side?",
          type: "text",
          required: true,
          placeholder: "e.g. 5 bridesmaids, 5 groomsmen, 2 flower kids",
          help: "Or 'no wedding party'.",
        },
        {
          id: "detailPhotos",
          label: "Detail photos you'd like prioritized",
          type: "checkbox",
          options: [
            "Rings",
            "Invitation suite / stationery flat-lay",
            "Dress hanging shot",
            "Suit / outfit hanging shot",
            "Shoes",
            "Jewelry / heirlooms",
            "Bouquet & florals",
            "Perfume / cologne",
            "Vow books",
            "Something old / new / borrowed / blue",
          ],
          help: "Bring these items together in one place when I arrive — I'll grab them quickly during getting-ready.",
        },
        {
          id: "mustTakePhotos",
          label: "Must-take photo ideas or reference shots",
          type: "textarea",
          placeholder:
            "Specific frames you've seen on Pinterest / Instagram, or family combinations that absolutely cannot be missed (e.g. all four grandparents, fraternity brothers, etc.)",
        },
        {
          id: "uniqueElements",
          label:
            "Anything unique, cultural, or personal you're incorporating that I should know about?",
          type: "textarea",
          placeholder:
            "Cultural traditions, heirloom rituals, surprise performance, unique vows, pet ring-bearer, anything I shouldn't accidentally crop out.",
          help: "The more I know, the more I can anticipate.",
        },
      ],
    },
    {
      title: "Elopement details",
      description:
        "A few quick logistics for your Mini ceremony so the day stays focused on the two of you.",
      showIf: { id: "package", equals: "Mini" },
      fields: [
        {
          id: "elopementWitnesses",
          label: "How many people will be there besides the two of you?",
          type: "number",
          help: "Officiant, witnesses, immediate family — anyone in the room counts.",
        },
        {
          id: "elopementPortraitTime",
          label:
            "Roughly how long do you want for couple + newlywed portraits after the ceremony?",
          type: "text",
          placeholder: "e.g. 30 minutes, an hour walking the venue grounds",
          help: "Mini coverage runs ~2 hours total — we'll plan ceremony + portraits inside that.",
        },
        {
          id: "elopementOutfitChange",
          label: "Will either of you be doing an outfit change?",
          type: "radio",
          options: YES_NO,
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
          placeholder: "Instagram, a friend, Google, vendor referral, etc.",
        },
        {
          id: "anythingElse",
          label: "Anything else I should know?",
          type: "textarea",
          placeholder:
            "Family dynamics, accessibility needs, surprises, things you're nervous about — this is a safe space.",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Cultural Milestones (Quinceañera, Sweet 16, Bar/Bat Mitzvah, debuts)
// ----------------------------------------------------------------------------

const culturalMilestonesQuestionnaire: Questionnaire = {
  slug: "cultural-milestones",
  title: "Cultural milestone planning questionnaire",
  intro:
    "Quinceañeras, Sweet 16s, Bar and Bat Mitzvahs, and debuts are once-in-a-lifetime celebrations. This questionnaire helps me show up ready for every tradition, every family combination, and every emotional moment.",
  audience: "Booked cultural-milestone clients",
  estimatedMinutes: 15,
  sections: [
    yourDetailsSection,
    bookingStatusSection("cultural-milestones"),
    {
      title: "About the celebration",
      fields: [
        {
          id: "honoreeName",
          label: "Honoree's full name",
          type: "text",
          required: true,
        },
        {
          id: "celebrationType",
          label: "What type of celebration?",
          type: "radio",
          required: true,
          options: [
            "Quinceañera",
            "Sweet 16",
            "Bat Mitzvah",
            "Bar Mitzvah",
            "Debut",
            "Other (describe in next field)",
          ],
        },
        {
          id: "celebrationOther",
          label: "If 'other', describe the celebration",
          type: "text",
          showIf: { id: "celebrationType", equals: "Other (describe in next field)" },
        },
        {
          id: "language",
          label: "Primary language(s) for the celebration",
          type: "text",
          placeholder: "e.g. Spanish, English, Hebrew, mixed",
        },
      ],
    },
    {
      title: "Ceremony / religious service",
      description:
        "Skipped automatically if you booked the standalone Pre-Event Portraits package.",
      showIf: { id: "package", notEquals: "Pre-Event Portraits" },
      fields: [
        {
          id: "religiousService",
          label: "Will there be a religious service or church ceremony?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "ceremonyVenue",
          label: "Ceremony / church name and full address",
          type: "textarea",
          showIf: { id: "religiousService", equals: "Yes" },
        },
        {
          id: "ceremonyTime",
          label: "Ceremony start time",
          type: "time",
          showIf: { id: "religiousService", equals: "Yes" },
        },
        {
          id: "ceremonyRestrictions",
          label: "Photography restrictions during the ceremony?",
          type: "textarea",
          placeholder: "e.g. no flash, photographer in balcony only — write 'none' if none.",
        },
      ],
    },
    {
      title: "Reception",
      description:
        "Skipped automatically if you booked the standalone Pre-Event Portraits package.",
      showIf: { id: "package", notEquals: "Pre-Event Portraits" },
      fields: [
        {
          id: "receptionVenue",
          label: "Reception venue name and full address",
          type: "textarea",
          required: true,
        },
        {
          id: "guestCount",
          label: "Approximate guest count",
          type: "number",
          required: true,
        },
        {
          id: "courtSize",
          label: "Court / chambelanes / damas — how many?",
          type: "text",
          placeholder: "e.g. 7 damas + 7 chambelanes, or 'no court'",
        },
        {
          id: "traditions",
          label: "Traditional moments to capture",
          type: "checkbox",
          options: [
            "Waltz / vals",
            "Surprise dance",
            "Changing of the shoes",
            "Last doll / última muñeca",
            "Father–daughter dance",
            "Candle ceremony",
            "Blessing / bendición",
            "Toast / brindis",
            "Cake cutting",
            "Court entrance",
          ],
        },
        {
          id: "specialMoments",
          label: "Other special / surprise moments planned",
          type: "textarea",
          placeholder: "Surprise performance, slideshow, choreographed routine…",
        },
      ],
    },
    {
      title: "Pre-event portrait session",
      description:
        "The Full Celebration package includes a separate pre-event session, and Pre-Event Portraits is a standalone version of it. Skipped automatically for the Reception Coverage package, which doesn't include a pre-event session.",
      showIf: { id: "package", notEquals: "Reception Coverage" },
      fields: [
        {
          id: "preEventSession",
          label: "Pre-event portrait session — date you'd like to schedule",
          type: "date",
        },
        {
          id: "preEventLocation",
          label: "Preferred location(s) for the pre-event session",
          type: "textarea",
          placeholder: "Park, monument, garden — I'm happy to suggest if you're not sure.",
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "mustTakePhotos",
          label: "Must-take family combinations or shot ideas",
          type: "textarea",
        },
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
        },
        {
          id: "anythingElse",
          label: "Anything else I should know?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Family Celebrations
// ----------------------------------------------------------------------------

const familyCelebrationsQuestionnaire: Questionnaire = {
  slug: "family-celebrations",
  title: "Family celebration planning questionnaire",
  intro:
    "Family events deserve the same documentary eye as a wedding. This questionnaire helps me arrive prepared for the moments that matter most to your family.",
  audience: "Booked family-celebration clients",
  estimatedMinutes: 8,
  sections: [
    yourDetailsSection,
    bookingStatusSection("family-celebrations"),
    {
      title: "About the celebration",
      fields: [
        {
          id: "celebrationType",
          label: "What kind of celebration?",
          type: "radio",
          required: true,
          options: [
            "1st birthday",
            "Baby shower",
            "Gender reveal",
            "Family reunion",
            "Milestone birthday",
            "Religious milestone (baptism, communion, etc.)",
            "Other",
          ],
        },
        {
          id: "celebrationOther",
          label: "If 'other', describe the celebration",
          type: "text",
          showIf: { id: "celebrationType", equals: "Other" },
        },
        {
          id: "guestOfHonor",
          label: "Guest of honor's name(s)",
          type: "text",
          required: true,
        },
        {
          id: "venue",
          label: "Venue name and full address",
          type: "textarea",
          required: true,
          help: "Backyard, restaurant, event hall — wherever it's happening.",
        },
        {
          id: "guestCount",
          label: "Approximate guest count",
          type: "number",
          required: true,
        },
      ],
    },
    {
      title: "Coverage",
      fields: [
        {
          id: "setupAccess",
          label: "What time can I arrive to capture setup details?",
          type: "time",
          help: "I like to grab cake, decor, table settings, and signage before guests arrive.",
        },
        {
          id: "keyMoments",
          label: "Key moments to capture",
          type: "checkbox",
          options: [
            "Setup / decor details",
            "Guest arrivals",
            "Group / family portrait",
            "Cake cutting / candles",
            "Gift opening",
            "Speeches / toasts",
            "Reveal moment (gender reveal, surprise, etc.)",
            "Kid play / candids",
          ],
        },
        {
          id: "topThree",
          label:
            "If you had to pick the three moments that absolutely cannot be missed, what are they?",
          type: "textarea",
          required: true,
          help: "The Gathering package is 2 hours of coverage — call out your top 3 so I prioritize them if the schedule gets tight.",
          showIf: { id: "package", equals: "Gathering" },
        },
        {
          id: "secondShooter",
          label:
            "Adding the second-shooter add-on for broader coverage of a large group?",
          type: "radio",
          options: YES_NO,
          help: "Useful when you have 60+ guests, multiple rooms, or simultaneous moments (kids' table while adults are toasting).",
          showIf: { id: "package", equals: "Milestone" },
        },
        {
          id: "formalPortraits",
          label: "Family / group portraits — list the combinations you want",
          type: "textarea",
          placeholder:
            "e.g. immediate family, all grandparents with the baby, all cousins, etc.",
        },
        {
          id: "specialNotes",
          label: "Anything unique or sensitive I should know?",
          type: "textarea",
          placeholder:
            "Family dynamics, accessibility needs, traditions, surprises, custodial considerations — anything.",
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Corporate & Community Events
// ----------------------------------------------------------------------------

const corporateEventsQuestionnaire: Questionnaire = {
  slug: "corporate-community-events",
  title: "Corporate / community event planning questionnaire",
  intro:
    "This brief helps me show up dialed in to your program — who matters, what to capture, and how the photos will be used.",
  audience: "Booked corporate / community event clients",
  estimatedMinutes: 10,
  sections: [
    yourDetailsSection,
    bookingStatusSection("corporate-community-events"),
    {
      title: "About the event",
      fields: [
        {
          id: "organization",
          label: "Organization or company name",
          type: "text",
          required: true,
        },
        {
          id: "eventName",
          label: "Event name",
          type: "text",
          required: true,
        },
        {
          id: "eventType",
          label: "Event type",
          type: "radio",
          required: true,
          options: [
            "Conference / multi-day program",
            "Speaker panel / single session",
            "Gala / fundraiser",
            "Hill / advocacy reception",
            "Corporate reception / mixer",
            "Holiday party",
            "Product launch",
            "Apartment / community resident event",
            "Other",
          ],
        },
        {
          id: "venue",
          label: "Venue name and full address",
          type: "textarea",
          required: true,
        },
        {
          id: "multiDay",
          label: "Is this a multi-day event?",
          type: "radio",
          required: true,
          options: YES_NO,
          showIf: { id: "package", notEquals: "Multi-Day Conference" },
        },
        {
          id: "multiDaySchedule",
          label: "Days and hours of coverage needed",
          type: "textarea",
          showIf: { id: "multiDay", equals: "Yes" },
          placeholder: "e.g. Mon Oct 14, 8am–6pm; Tue Oct 15, 9am–4pm",
        },
        {
          id: "conferenceSchedule",
          label: "Multi-day program — paste the daily schedule",
          type: "textarea",
          required: true,
          placeholder:
            "e.g. Day 1 (Mon Oct 14) 8am–6pm: keynote + breakouts. Day 2 (Tue Oct 15) 9am–4pm: workshops + closing reception.",
          showIf: { id: "package", equals: "Multi-Day Conference" },
        },
        {
          id: "expectedAttendance",
          label: "Approximate attendance",
          type: "number",
        },
      ],
    },
    {
      title: "Program & coverage priorities",
      fields: [
        {
          id: "runOfShow",
          label: "Schedule / run-of-show — paste it or summarize key moments",
          type: "textarea",
          required: true,
        },
        {
          id: "vips",
          label:
            "VIPs, speakers, or attendees I should prioritize (names, titles, where they'll be)",
          type: "textarea",
        },
        {
          id: "shotPriorities",
          label: "Shot priorities",
          type: "checkbox",
          options: [
            "Speakers on stage",
            "Audience reactions",
            "Posed grip-and-grins",
            "Networking / candids",
            "Sponsor logos & signage",
            "Branded backdrops / step-and-repeat",
            "Setup / venue details",
            "Awards presentation",
            "Behind-the-scenes",
          ],
        },
        {
          id: "logoCapture",
          label: "Specific sponsor logos / signage that MUST appear in photos",
          type: "textarea",
          placeholder:
            "Sponsors paying for logo placement, partner brands, activation walls, etc.",
          showIf: { id: "package", notEquals: "Community Event" },
        },
      ],
    },
    {
      title: "Deliverables & usage",
      fields: [
        {
          id: "sameDay",
          label: "Same-day social selects needed?",
          type: "radio",
          required: true,
          options: ["Yes — during event", "Yes — by end of day", "No"],
        },
        {
          id: "usage",
          label: "How will the photos be used?",
          type: "checkbox",
          options: [
            "Social media",
            "Press release",
            "Annual report",
            "Marketing collateral",
            "Website hero / banners",
            "Internal slack / newsletter",
            "Sponsor recap deck",
          ],
        },
        {
          id: "press",
          label: "Will I need press credentials or pre-clearance?",
          type: "radio",
          required: true,
          options: YES_NO,
          showIf: { id: "package", notEquals: "Community Event" },
        },
        {
          id: "pressContact",
          label: "Press / clearance contact name and email",
          type: "text",
          showIf: { id: "press", equals: "Yes" },
        },
        {
          id: "residentVibes",
          label:
            "Tone you want the photos to convey for residents / community",
          type: "checkbox",
          options: [
            "Warm and welcoming",
            "Active / lively",
            "Relaxed / candid",
            "Polished / branded for property marketing",
          ],
          help: "Helps me set the mood and pick which candids to lean into for the gallery.",
          showIf: { id: "package", equals: "Community Event" },
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "onSiteContact",
          label: "On-site point of contact (name + cell)",
          type: "text",
          required: true,
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Concerts & Performances
// ----------------------------------------------------------------------------

const concertsPerformancesQuestionnaire: Questionnaire = {
  slug: "concerts-performances",
  title: "Concert / performance planning questionnaire",
  intro:
    "Concert and stage photography is its own discipline — fast light, no second chances. This brief helps me work with your stage manager and lighting crew so I'm never in the way of the show.",
  audience: "Booked artists, venues, and event organizers",
  estimatedMinutes: 8,
  sections: [
    yourDetailsSection,
    bookingStatusSection("concerts-performances"),
    {
      title: "About the show",
      fields: [
        {
          id: "billing",
          label: "Performing artist(s) / billing",
          type: "textarea",
          required: true,
          placeholder: "Headliner, openers, order of performance",
        },
        {
          id: "venue",
          label: "Venue name and full address",
          type: "textarea",
          required: true,
        },
        {
          id: "doorsTime",
          label: "Doors time",
          type: "time",
        },
        {
          id: "showStart",
          label: "Show start time",
          type: "time",
          required: true,
        },
        {
          id: "setSchedule",
          label: "Set schedule (acts, set lengths, expected end)",
          type: "textarea",
          required: true,
        },
      ],
    },
    {
      title: "Access & restrictions",
      description:
        "Concert-specific access (soundcheck, backstage, 3-song rule) is hidden automatically when you book the Recital / Showcase package — those shows have different etiquette.",
      fields: [
        {
          id: "soundcheckAccess",
          label: "Will I have soundcheck access?",
          type: "radio",
          required: true,
          options: YES_NO,
          showIf: { id: "package", notEquals: "Recital / Showcase" },
        },
        {
          id: "soundcheckTime",
          label: "Soundcheck time",
          type: "time",
          showIf: { id: "soundcheckAccess", equals: "Yes" },
        },
        {
          id: "rehearsalAccess",
          label:
            "Will I have rehearsal / dress-rehearsal access ahead of the show?",
          type: "radio",
          options: YES_NO,
          help: "Rehearsal coverage is often the cleanest way to get cast and crew portraits before the lights drop.",
          showIf: { id: "package", equals: "Recital / Showcase" },
        },
        {
          id: "rehearsalTime",
          label: "Rehearsal start time",
          type: "time",
          showIf: { id: "rehearsalAccess", equals: "Yes" },
        },
        {
          id: "backstage",
          label: "Will I have backstage / green-room access?",
          type: "radio",
          required: true,
          options: YES_NO,
          showIf: { id: "package", notEquals: "Recital / Showcase" },
        },
        {
          id: "backstageRecital",
          label: "Will I have backstage / dressing-room access for posed cast shots?",
          type: "radio",
          options: YES_NO,
          showIf: { id: "package", equals: "Recital / Showcase" },
        },
        {
          id: "threeSongRule",
          label: "Does the artist enforce a 3-song / no-flash rule?",
          type: "radio",
          required: true,
          options: ["Yes — 3 songs no flash", "Yes — other restriction (describe below)", "No"],
          showIf: { id: "package", notEquals: "Recital / Showcase" },
        },
        {
          id: "shotRestrictions",
          label: "Other photo restrictions or requirements",
          type: "textarea",
          placeholder:
            "Photo pit only, no audience-side shots, no posting before X, watermark required, etc.",
        },
      ],
    },
    {
      title: "Coverage priorities & deliverables",
      fields: [
        {
          id: "shotPriorities",
          label: "What should I prioritize?",
          type: "checkbox",
          options: [
            "Headliner — full set",
            "Openers",
            "Crowd / audience reactions",
            "Lighting moments / stage atmosphere",
            "Backstage / artist candids",
            "Soundcheck",
            "Load-in / load-out",
            "Merch / venue details",
          ],
          showIf: { id: "package", notEquals: "Recital / Showcase" },
        },
        {
          id: "recitalPriorities",
          label: "What should I prioritize for the recital / showcase?",
          type: "checkbox",
          options: [
            "Performance moments on stage",
            "Posed full-cast group shot",
            "Posed shots by act / number",
            "Solo performer portraits",
            "Director / instructor candids",
            "Curtain call",
            "Backstage candids",
            "Flowers / award presentations",
          ],
          showIf: { id: "package", equals: "Recital / Showcase" },
        },
        {
          id: "sameDay",
          label: "Same-day social selects?",
          type: "radio",
          required: true,
          options: ["Yes — during set", "Yes — by end of night", "No"],
        },
        {
          id: "usage",
          label: "How will the photos be used?",
          type: "checkbox",
          options: [
            "Artist social media",
            "Venue social / website",
            "Press / publication",
            "Tour book / merchandise",
            "Sponsor / promoter recap",
          ],
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "stageManagerContact",
          label: "Stage manager / on-site contact (name + cell)",
          type: "text",
          required: true,
          help: "For Recital / Showcase packages this is usually the director or program coordinator.",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Maternity
// ----------------------------------------------------------------------------

const maternityQuestionnaire: Questionnaire = {
  slug: "maternity",
  title: "Maternity session planning questionnaire",
  intro:
    "Maternity sessions are paced around your comfort. This questionnaire helps me plan a session that feels easy and looks like the version of this chapter you'll want to remember.",
  audience: "Booked maternity clients",
  estimatedMinutes: 6,
  sections: [
    yourDetailsSection,
    bookingStatusSection("maternity"),
    {
      title: "About the session",
      fields: [
        {
          id: "dueDate",
          label: "Due date",
          type: "date",
          required: true,
        },
        {
          id: "weeksAtSession",
          label: "How many weeks along will you be at the session?",
          type: "number",
        },
        {
          id: "sessionType",
          label: "What kind of vibe are you hoping for?",
          type: "radio",
          required: true,
          options: [
            "Soft / outdoor / golden hour",
            "Studio / clean backdrop",
            "Both",
            "In-home / lifestyle",
            "Open to suggestions",
          ],
        },
        {
          id: "wardrobeHelp",
          label: "Want help with wardrobe (sourcing dresses, what to wear)?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
      ],
    },
    {
      title: "Who's in the session",
      fields: [
        {
          id: "partner",
          label: "Will your partner be in the photos?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "siblings",
          label: "Will any siblings or kids be in the photos?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "siblingDetails",
          label: "If yes — names and ages",
          type: "text",
          showIf: { id: "siblings", equals: "Yes" },
        },
        {
          id: "pets",
          label: "Bringing any pets?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
      ],
    },
    {
      title: "Comfort & wrap-up",
      fields: [
        {
          id: "healthConsiderations",
          label:
            "Any pacing, comfort, or health considerations I should plan around?",
          type: "textarea",
          placeholder:
            "Bed rest, swelling, stairs, time of day that feels best, etc. — I'll plan accordingly.",
        },
        {
          id: "inspiration",
          label: "Inspiration links or references",
          type: "textarea",
          placeholder: "Pinterest, Instagram saves, anything you've been gathering.",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Newborn & First Year
// ----------------------------------------------------------------------------

const newbornQuestionnaire: Questionnaire = {
  slug: "newborn",
  title: "Newborn & first-year planning questionnaire",
  intro:
    "Newborn sessions are slow, quiet, and built around the baby's pace. This questionnaire helps me plan around your home, your family, and the chapter you're in.",
  audience: "Booked newborn / first-year clients",
  estimatedMinutes: 6,
  sections: [
    yourDetailsSection,
    bookingStatusSection("newborn"),
    {
      title: "About the baby",
      fields: [
        {
          id: "babyName",
          label: "Baby's name (or 'TBD')",
          type: "text",
          required: true,
        },
        {
          id: "birthDate",
          label: "Baby's birth date (or due date)",
          type: "date",
          required: true,
        },
        {
          id: "sessionWindow",
          label: "Best 3-day window for the session",
          type: "text",
          required: true,
          help: "Newborn sessions are best in the first 2–3 weeks.",
          placeholder: "e.g. Aug 12–14",
        },
      ],
    },
    {
      title: "Session details",
      fields: [
        {
          id: "address",
          label: "Address where the session will take place",
          type: "textarea",
          required: true,
        },
        {
          id: "siblings",
          label: "Will siblings be part of the session?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "siblingDetails",
          label: "Sibling names and ages",
          type: "text",
          showIf: { id: "siblings", equals: "Yes" },
        },
        {
          id: "pets",
          label: "Will any pets be in the photos?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "heirlooms",
          label:
            "Heirlooms or meaningful items you'd like included (blanket, jewelry, books)?",
          type: "textarea",
        },
        {
          id: "wardrobeHelp",
          label: "Want guidance on what to wear?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "feedingNotes",
          label: "Feeding / sleep notes I should plan around",
          type: "textarea",
          placeholder:
            "Best feeding window, nap schedule, anything that affects timing.",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Portraiture
// ----------------------------------------------------------------------------

const portraitureQuestionnaire: Questionnaire = {
  slug: "portraiture",
  title: "Portrait session planning questionnaire",
  intro:
    "Portrait sessions feel best when we've talked through wardrobe, location, and what you want the photos to do for you before we shoot. This brief helps me plan a session you'll actually enjoy and walk away with a set of photos you love.",
  audience: "Booked portraiture clients",
  estimatedMinutes: 7,
  sections: [
    yourDetailsSection,
    bookingStatusSection("portraiture"),
    {
      title: "What the session is for",
      fields: [
        {
          id: "purpose",
          label: "What are these photos for?",
          type: "checkbox",
          options: [
            "Personal branding / website",
            "Creative portfolio / artist book",
            "LinkedIn / professional",
            "Dating-app refresh",
            "Anniversary or partner gift",
            "Print / wall art",
            "Just because I deserve it",
            "Other",
          ],
        },
        {
          id: "purposeOther",
          label: "If 'other', what are they for?",
          type: "text",
          showIf: { id: "purpose", equals: "Other" },
        },
        {
          id: "endUse",
          label: "Where will the photos live?",
          type: "checkbox",
          options: [
            "Personal social media",
            "Brand / business social",
            "Website",
            "Press kit",
            "Print",
            "Private use only",
          ],
        },
      ],
    },
    {
      title: "Look & vibe",
      fields: [
        {
          id: "vibe",
          label: "What kind of vibe are you hoping for?",
          type: "radio",
          required: true,
          options: [
            "Soft / outdoor / golden hour",
            "Studio / clean backdrop",
            "Urban / street",
            "Editorial / moody",
            "Documentary / lifestyle",
            "Open to your suggestions",
          ],
        },
        {
          id: "outfits",
          label: "How many outfits are you planning?",
          type: "number",
          help: "Premium includes unlimited; Signature includes 2; Essentials includes 1.",
        },
        {
          id: "outfitDescriptions",
          label: "Describe your outfit ideas",
          type: "textarea",
          placeholder:
            "Color, formal vs. casual, anything you're excited about — I can help finalize if you're stuck.",
        },
        {
          id: "wardrobeHelp",
          label: "Want a wardrobe + location planning call ahead of the session?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "Included with the Premium package; available as a brief check-in for other tiers.",
        },
      ],
    },
    {
      title: "Location",
      fields: [
        {
          id: "locationPreference",
          label: "Studio, outdoor, or both?",
          type: "radio",
          required: true,
          options: [
            "Outdoor only",
            "Studio only",
            "Both / mixed",
            "Open to suggestions",
          ],
        },
        {
          id: "locationIdeas",
          label: "Specific locations you have in mind",
          type: "textarea",
          placeholder:
            "Park, neighborhood, your studio, monument, a meaningful spot — list anything, or write 'none — surprise me'.",
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "inspiration",
          label: "Inspiration links or references",
          type: "textarea",
          placeholder:
            "Pinterest, Instagram saves, photos you love — drop links or describe.",
        },
        {
          id: "pacingNotes",
          label: "Anything I should plan around (pacing, accessibility, anxiety with cameras, etc.)?",
          type: "textarea",
          help: "I shoot at the pace that works for you — the more I know, the smoother it goes.",
        },
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Graduation
// ----------------------------------------------------------------------------

const graduationQuestionnaire: Questionnaire = {
  slug: "graduation",
  title: "Graduation session planning questionnaire",
  intro:
    "Graduation day is once in a lifetime. This brief helps me plan around your school, your locations, and the people who got you here — plus handle any National Mall permits ahead of time.",
  audience: "Booked graduation clients",
  estimatedMinutes: 6,
  sections: [
    yourDetailsSection,
    bookingStatusSection("graduation"),
    {
      title: "About the graduate",
      fields: [
        {
          id: "graduateName",
          label: "Graduate's full name",
          type: "text",
          required: true,
          help: "If this is a Study Group session, list yours — we'll capture each grad's name in the next section.",
        },
        {
          id: "school",
          label: "School / university name",
          type: "text",
          required: true,
        },
        {
          id: "degree",
          label: "Degree / program (e.g. BS Biology, MBA, JD)",
          type: "text",
          required: true,
        },
        {
          id: "graduationDate",
          label: "Official graduation / commencement date",
          type: "date",
          required: true,
        },
        {
          id: "capGownAvailable",
          label: "Will you have your cap and gown by the session?",
          type: "radio",
          required: true,
          options: YES_NO,
        },
        {
          id: "capGownColors",
          label: "Cap & gown colors / hood colors / honors stoles",
          type: "text",
          placeholder: "Helpful for planning backdrops and outfit pairings.",
        },
      ],
    },
    {
      title: "Session type & people",
      fields: [
        {
          id: "sessionType",
          label: "Which kind of grad session are you booked into?",
          type: "radio",
          required: true,
          options: [
            "Solo (Signature or Mini Cap & Gown)",
            "Study Group (squad of grads)",
            "Family Graduation Session",
          ],
        },
        {
          id: "additionalGrads",
          label: "Number of additional graduates in your squad",
          type: "number",
          help: "Study Group base covers 2 graduates; each additional grad is +$60.",
          showIf: { id: "sessionType", equals: "Study Group (squad of grads)" },
        },
        {
          id: "squadNames",
          label: "Names of the other graduates and their schools / programs",
          type: "textarea",
          showIf: { id: "sessionType", equals: "Study Group (squad of grads)" },
        },
        {
          id: "familyCount",
          label: "Number of family members joining",
          type: "number",
          help: "Family Graduation base covers 4 people; each additional family member is +$25.",
          showIf: { id: "sessionType", equals: "Family Graduation Session" },
        },
        {
          id: "familyMembers",
          label: "Names of family members and their relationship to the graduate",
          type: "textarea",
          placeholder: "e.g. mom (Maria), dad (Luis), little sister (Ana, 8)",
          showIf: { id: "sessionType", equals: "Family Graduation Session" },
        },
        {
          id: "mustTakeCombos",
          label: "Must-take family / group combinations",
          type: "textarea",
          placeholder:
            "Specific combos you absolutely want — solo with mom, all siblings, grandparents, etc.",
          showIf: { id: "sessionType", equals: "Family Graduation Session" },
        },
      ],
    },
    {
      title: "Location & permits",
      fields: [
        {
          id: "locationIdeas",
          label: "Locations you have in mind",
          type: "checkbox",
          options: [
            "On campus",
            "Lincoln Memorial",
            "U.S. Capitol",
            "Jefferson Memorial",
            "Tidal Basin / Cherry Blossoms",
            "Washington Monument",
            "Library of Congress",
            "Georgetown",
            "DC neighborhood I love",
            "Open to your suggestions",
          ],
        },
        {
          id: "campusName",
          label: "If on-campus — what campus and what spots?",
          type: "textarea",
          placeholder:
            "Specific landmarks, buildings, or areas of campus that mean something to you.",
        },
        {
          id: "permitAssistance",
          label:
            "Want me to handle the National Mall / monument permit?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "Permit handling is a $150 add-on. Required for the Mall and most monument areas.",
        },
        {
          id: "outfits",
          label: "How many outfits will you bring?",
          type: "number",
          help: "Signature Graduate includes 2 outfits; Mini Cap & Gown includes 1.",
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "inspiration",
          label: "Pose ideas or inspiration links",
          type: "textarea",
          placeholder: "Pinterest, Instagram, or specific shots you've seen and loved.",
        },
        {
          id: "props",
          label: "Bringing any props? (diploma, school flag, stole, sash, etc.)",
          type: "text",
        },
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Corporate Headshots
// ----------------------------------------------------------------------------

const corporateHeadshotsQuestionnaire: Questionnaire = {
  slug: "corporate-headshots",
  title: "Headshots planning questionnaire",
  intro:
    "Headshot sessions are quick on the day of, but the more I know about your branding, end use, and team logistics ahead of time, the more polished the result.",
  audience: "Booked headshot clients (individuals and teams)",
  estimatedMinutes: 6,
  sections: [
    yourDetailsSection,
    bookingStatusSection("corporate-headshots"),
    {
      title: "Session type",
      fields: [
        {
          id: "sessionType",
          label: "Individual or team session?",
          type: "radio",
          required: true,
          options: [
            "Individual (one person)",
            "Team Bundle (5+ people, on-location or studio)",
            "On-site Half-Day (up to 20 headshots, I bring the studio to you)",
          ],
        },
        {
          id: "company",
          label: "Company / organization name",
          type: "text",
        },
        {
          id: "teamSize",
          label: "Approximate headcount for the team session",
          type: "number",
          help: "Team Bundle has a 5-person minimum at $125/person. On-site Half-Day covers up to 20.",
          showIf: { id: "sessionType", equals: "Team Bundle (5+ people, on-location or studio)" },
        },
        {
          id: "halfDayHeadcount",
          label: "Approximate headcount for the half-day session",
          type: "number",
          showIf: { id: "sessionType", equals: "On-site Half-Day (up to 20 headshots, I bring the studio to you)" },
        },
      ],
    },
    {
      title: "Location & logistics",
      fields: [
        {
          id: "locationType",
          label: "On-site or studio?",
          type: "radio",
          required: true,
          options: ["On-site (I come to you)", "Studio", "Either / open"],
        },
        {
          id: "locationAddress",
          label: "On-site address",
          type: "textarea",
          showIf: { id: "locationType", equals: "On-site (I come to you)" },
          help: "Include any access notes, loading dock, parking, freight elevator, etc.",
        },
        {
          id: "spaceAvailable",
          label: "Space available for setup",
          type: "textarea",
          placeholder:
            "I need ~10x10 ft of clear floor space and a power outlet. Conference room, open office, lobby — whatever you have.",
          showIf: { id: "locationType", equals: "On-site (I come to you)" },
        },
        {
          id: "scheduling",
          label: "How should team headshot scheduling work?",
          type: "radio",
          options: [
            "Block schedule (I book 15-min slots in advance)",
            "Drop-in (people stop by when free)",
            "Mix of both",
          ],
          showIf: { id: "sessionType", equals: "Team Bundle (5+ people, on-location or studio)" },
        },
        {
          id: "deadline",
          label: "Hard deadline for delivery (if any)",
          type: "date",
          help: "e.g. an annual report drop, a press release, a website launch.",
        },
      ],
    },
    {
      title: "Look, branding & end use",
      fields: [
        {
          id: "background",
          label: "Background preference",
          type: "radio",
          required: true,
          options: [
            "Neutral / clean (white, gray, navy)",
            "Branded / colored (match brand palette)",
            "Multiple backgrounds",
            "Office / on-location environmental",
            "Open to your recommendation",
          ],
        },
        {
          id: "brandColors",
          label: "If branded — what are your brand colors?",
          type: "text",
          showIf: { id: "background", equals: "Branded / colored (match brand palette)" },
        },
        {
          id: "retouchingStyle",
          label: "Retouching style preference",
          type: "radio",
          required: true,
          options: [
            "Natural — clean up obvious distractions only",
            "Polished — softer skin, even tones",
            "Heavier — magazine-style finish",
          ],
          help: "All packages include retouched final selects.",
        },
        {
          id: "wardrobeGuidance",
          label: "Want wardrobe guidance ahead of time?",
          type: "radio",
          required: true,
          options: YES_NO,
          help: "Included in the Professional package; available on request for others.",
        },
        {
          id: "endUse",
          label: "Where will the headshots be used?",
          type: "checkbox",
          options: [
            "LinkedIn",
            "Company About / Team page",
            "Press kit / media",
            "Internal directory",
            "Email signature",
            "Conference / speaker bios",
            "Annual report",
          ],
        },
      ],
    },
    {
      title: "Wrap-up",
      fields: [
        {
          id: "accessibility",
          label: "Accessibility or pacing considerations for the team",
          type: "textarea",
          placeholder:
            "Mobility, lighting sensitivity, language considerations, scheduling around prayer / breaks — anything I should plan around.",
        },
        {
          id: "onSiteContact",
          label: "On-site point of contact (name + cell)",
          type: "text",
          showIf: { id: "locationType", equals: "On-site (I come to you)" },
        },
        {
          id: "referral",
          label: "How did you find me?",
          type: "text",
        },
        {
          id: "anythingElse",
          label: "Anything else?",
          type: "textarea",
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

export const QUESTIONNAIRES: Partial<Record<ServiceSlug, Questionnaire>> = {
  weddings: weddingQuestionnaire,
  "cultural-milestones": culturalMilestonesQuestionnaire,
  "family-celebrations": familyCelebrationsQuestionnaire,
  "corporate-community-events": corporateEventsQuestionnaire,
  "concerts-performances": concertsPerformancesQuestionnaire,
  maternity: maternityQuestionnaire,
  newborn: newbornQuestionnaire,
  portraiture: portraitureQuestionnaire,
  graduation: graduationQuestionnaire,
  "corporate-headshots": corporateHeadshotsQuestionnaire,
};

export function getQuestionnaire(slug: string): Questionnaire | undefined {
  return QUESTIONNAIRES[slug as ServiceSlug];
}

export function listQuestionnaires(): Questionnaire[] {
  return (Object.values(QUESTIONNAIRES) as Questionnaire[]).filter(Boolean);
}

// Resolve a "package" type field's options at runtime by reading the matching
// service's package list. Adds a "Still deciding" option for prospects.
export function resolvePackageOptions(slug: string): string[] {
  const svc = services.find((s) => s.slug === slug);
  if (!svc) return ["Still deciding"];
  return [...svc.packages.map((p) => p.name), "Still deciding"];
}

// Helper for the API route — flattens every field across every section so the
// server can validate / format submissions without re-implementing the schema.
export function allFields(q: Questionnaire): Field[] {
  return q.sections.flatMap((s) => s.fields);
}

// ----------------------------------------------------------------------------
// Visibility evaluation
// ----------------------------------------------------------------------------

// Single source of truth for showIf semantics — used by the form component
// (client) and the /api/questionnaire route (server) so visibility logic can't
// drift between rendering and validation.
export function evaluateShowIf(
  clause: ShowIfClause | undefined,
  state: Record<string, string | string[] | undefined>,
): boolean {
  if (!clause) return true;
  const v = state[clause.id];
  const matches = (target: string): boolean => {
    if (v === undefined) return false;
    return Array.isArray(v) ? v.includes(target) : v === target;
  };
  if (clause.equals !== undefined) return matches(clause.equals);
  if (clause.equalsAny !== undefined) return clause.equalsAny.some(matches);
  if (clause.notEquals !== undefined) {
    if (v === undefined || v === "") return true;
    return !matches(clause.notEquals);
  }
  if (clause.notEqualsAny !== undefined) {
    if (v === undefined || v === "") return true;
    return !clause.notEqualsAny.some(matches);
  }
  return true;
}

// Returns the sections that should currently be shown given the form state.
export function visibleSectionsFor(
  q: Questionnaire,
  state: Record<string, string | string[] | undefined>,
): Section[] {
  return q.sections.filter((s) => evaluateShowIf(s.showIf, state));
}
