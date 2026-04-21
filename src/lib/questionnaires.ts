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
  | "package" // auto-populated from the service's packages
  | "file"; // uploads to Vercel Blob; value is a JSON-encoded { url, name, size }[]

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
  // File-field-only options:
  accept?: string; // passed to <input accept="…">, defaults to images + PDFs
  maxFiles?: number; // defaults to 10
  maxFileSizeMb?: number; // defaults to 10
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
      help: "I love connecting with my clients — totally optional!",
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
  audience: "Booked and prospective wedding couples",
  estimatedMinutes: 25,
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
      title: "Getting ready",
      description:
        "Coverage of prep, hair, makeup, and the small moments before the ceremony.",
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
          type: "checkbox",
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
        "Everyone and everything involved in making your day perfect.",
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
      title: "Family portrait groupings",
      description:
        "Names and groupings for formal portraits — so I can call people by name and keep the session moving.",
      showIf: { id: "package", notEquals: "Mini" },
      fields: [
        {
          id: "familyPortraitsPlanned",
          label: "Will we be doing formal family portraits?",
          type: "radio",
          required: true,
          options: [
            "Yes — during cocktail hour / after ceremony",
            "Yes — before the ceremony",
            "Minimal — just immediate family",
            "No formal family portraits",
          ],
        },
        {
          id: "brideParentsNames",
          label: "Bride's / Partner 1's parents' names",
          type: "text",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
          help: "First names only — so I can call people by name during portraits.",
        },
        {
          id: "groomParentsNames",
          label: "Groom's / Partner 2's parents' names",
          type: "text",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
        {
          id: "brideSiblingsNames",
          label: "Bride's / Partner 1's siblings' names",
          type: "text",
          placeholder: "e.g. Sarah, Michael, Alex",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
        {
          id: "groomSiblingsNames",
          label: "Groom's / Partner 2's siblings' names",
          type: "text",
          placeholder: "e.g. James, Emily",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
        {
          id: "grandparentsNames",
          label: "Grandparents attending (both sides)",
          type: "textarea",
          placeholder:
            "e.g. Bride's side: Grandma Rosa, Grandpa Luis. Groom's side: Nana Pat",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
        {
          id: "additionalFamilyGroupings",
          label: "Other specific family groupings you want?",
          type: "textarea",
          placeholder:
            "List any additional groupings beyond the standard ones (couple + each set of parents, couple + siblings, etc.)",
          help: "e.g. 'All the cousins', 'bride with her aunts', 'groom with fraternity brothers'.",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
        {
          id: "familyPortraitNotes",
          label: "Notes about family dynamics I should be aware of",
          type: "textarea",
          help: "VIPs to prioritize, divorced parents needing separate frames, accessibility needs, etc.",
          showIf: {
            id: "familyPortraitsPlanned",
            notEquals: "No formal family portraits",
          },
        },
      ],
    },
    {
      title: "Ceremony",
      description:
        "Coverage of the main event.",
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
          id: "ceremonyMoments",
          label: "Ceremony moments to prioritize",
          type: "checkbox",
          options: [
            "Processional / walking down the aisle",
            "Ring exchange",
            "Vow reading",
            "First kiss",
            "Recessional",
            "Guests' reactions",
            "Unity candle / sand ceremony / other ritual",
            "Officiant close-ups",
            "Aisle decor and ceremony setup",
          ],
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
        "The fun part! Special entrances, dances, speeches, and other logistics should be specified.",
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
          id: "receptionMoments",
          label: "Reception moments to prioritize",
          type: "checkbox",
          showIf: { id: "package", notEquals: "Mini" },
          options: [
            "Wedding party grand entrance",
            "Newlywed grand entrance",
            "Speeches / toasts",
            "Table details / centerpieces",
            "Cake cutting & first bites",
            "Bouquet / garter toss",
            "DJ / band performing",
            "Dance floor candids",
            "Guest candids / table visits",
          ],
        },
        {
          id: "specialDances",
          label: "Any special dances planned?",
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
          id: "sunsetPortraits",
          label:
            "Want me to steal you both away for 5–10 minutes of golden-hour / sunset portraits during the reception?",
          type: "radio",
          required: true,
          options: ["Yes, please", "No thanks", "Up to you / surprise me"],
          help: "This is almost always a highlight of the gallery — I highly recommend it.",
        },
        {
          id: "sunsetTime",
          label: "Approximate sunset session time",
          type: "time",
          showIf: {
            id: "sunsetPortraits",
            equalsAny: [
              "Yes, please",
              "Up to you / surprise me",
            ]
          },
          help: "Plan to start around 20-30 min before sunset.",
        },
        {
          id: "formalExit",
          label:
            "Are you doing a formal exit (sparklers, glow sticks, bubbles, getaway car, etc.)?",
          type: "radio",
          required: true,
          options: ["Yes, we're exiting in style!", "No, we'll just slip away quietly"],
        },
        {
          id: "formalExitDescription",
          label:
            "Describe your sendoff!",
          type: "textarea",
          showIf: { id: "formalExit", equals: "Yes, we're exiting in style!"},
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
      title: "Day-of timeline",
      description:
        "Fill in the times you know — leave blank any you haven't nailed down yet. This builds the schedule section of your wedding day plan.",
      showIf: { id: "package", notEquals: "Mini" },
      fields: [
        {
          id: "photoStartTime",
          label: "What time should I arrive to start shooting?",
          type: "time",
          required: true,
          help: "Usually 30–60 min before getting-ready coverage begins.",
        },
        {
          id: "gettingReadyTime",
          label: "Getting-ready coverage start time",
          type: "time",
          showIf: { id: "gettingReady", equals: "Yes" },
        },
        {
          id: "firstLookTime",
          label: "First look / first touch time",
          type: "time",
          showIf: {
            id: "firstLook",
            notEqualsAny: [
              "No first look — we want to see each other at the aisle",
              "Still deciding",
            ],
          },
        },
        {
          id: "cocktailHourTime",
          label: "Cocktail hour start time",
          type: "time",
        },
        {
          id: "cocktailHourLocation",
          label:
            "Cocktail hour location (if different from ceremony / reception)",
          type: "text",
          placeholder: "Same as ceremony / reception, or provide address",
        },
        {
          id: "receptionStartTime",
          label: "Reception start time",
          type: "time",
        },
        {
          id: "sendoffTime",
          label: "Expected sendoff / last photo time",
          type: "time",
        },
        {
          id: "timelineNotes",
          label: "Timing constraints or notes",
          type: "textarea",
          help: "Vendor arrival conflicts, venue curfews, hard stops, or anything that might affect the schedule.",
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
          id: "inspirationFiles",
          label: "Upload inspiration photos (optional)",
          type: "file",
          help: "Mood-board images, Pinterest saves you've downloaded, or references for the vibe, outfits, or specific shots you love. Images and PDFs, up to 10 files.",
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
  audience: "Booked and prospective cultural-milestone clients",
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
        "Making sure we commemorate the main event appropriately.",
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
        "The fun part! Add any special traditions, VIPs, and moments to capture..",
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
        "The Full Celebration package includes a separate pre-event session, and Pre-Event Portraits is a standalone version of it.",
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
          id: "inspirationFiles",
          label: "Upload reference photos for cultural details or outfits (optional)",
          type: "file",
          help: "Traditional dress details, family heirlooms, specific poses or shots you want to capture. Images and PDFs, up to 10 files.",
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
  audience: "Booked and prospective family-celebration clients",
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
  audience: "Booked and prospective corporate / community event clients",
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
  audience: "Booked and prospective artists, venues, and event organizers",
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
  audience: "Booked and prospective maternity clients",
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
          id: "inspirationFiles",
          label: "Upload wardrobe or pose inspiration (optional)",
          type: "file",
          help: "Mood-board images, wardrobe shots, or specific poses you've been saving. Images and PDFs, up to 10 files.",
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
  audience: "Booked and prospective newborn / first-year clients",
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
          id: "inspirationFiles",
          label: "Upload heirloom items or reference photos (optional)",
          type: "file",
          help: "Family heirlooms (blankets, outfits), nursery details, or reference photos of the look you'd like to capture. Images and PDFs, up to 10 files.",
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
  audience: "Booked and prospective portraiture clients",
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
          id: "inspirationFiles",
          label: "Upload mood-board or wardrobe photos (optional)",
          type: "file",
          help: "Mood-board images, wardrobe shots, or reference portraits you've been saving. Images and PDFs, up to 10 files.",
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
  audience: "Booked and prospective graduation clients",
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
  audience: "Booked and prospective headshot clients (individuals and teams)",
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
// Engagements & Couples — branches on session purpose (Surprise vs everything else)
// ----------------------------------------------------------------------------

const engagementsCouplesQuestionnaire: Questionnaire = {
  slug: "engagements-couples",
  title: "Engagement & couples session questionnaire",
  intro:
    "A few questions so I can plan a session that feels like the two of you. Whether it's an engagement, an anniversary, a surprise proposal, or just because — your answers help me show up with the right plan.",
  audience: "Booked and prospective engagement / couples clients",
  estimatedMinutes: 8,
  sections: [
    yourDetailsSection,
    bookingStatusSection("engagements-couples"),
    {
      title: "About the two of you",
      fields: [
        {
          id: "partnerName",
          label: "Your partner's name",
          type: "text",
          required: true,
        },
        {
          id: "relationshipLength",
          label: "How long have you been together?",
          type: "text",
          required: true,
          placeholder: "e.g. 3 years, 8 months",
        },
        {
          id: "howYouMet",
          label: "How did you two meet? (one or two lines)",
          type: "textarea",
        },
        {
          id: "vibe",
          label: "How would you describe your dynamic together?",
          type: "radio",
          required: true,
          options: [
            "Quiet & cinematic",
            "Playful & goofy",
            "Glam & editorial",
            "Warm documentary",
            "Other / not sure",
          ],
        },
      ],
    },
    {
      title: "Surprise proposal logistics",
      description:
        "Everything I need to stay invisible until the moment, then pivot into a portrait session right after.",
      showIf: { id: "package", equals: "Surprise Proposal" },
      fields: [
        {
          id: "proposalDate",
          label: "Proposal date",
          type: "date",
          required: true,
        },
        {
          id: "proposalTimeOfDay",
          label: "Approximate time of day",
          type: "time",
          required: true,
        },
        {
          id: "proposalLocation",
          label: "Proposed location (the spot itself)",
          type: "textarea",
          required: true,
          help: "Be as specific as possible — the bench by the south fountain, the second overlook on the trail, etc.",
        },
        {
          id: "proposalArrival",
          label: "How will you arrive at the spot?",
          type: "radio",
          required: true,
          options: [
            "Walking (we'll just show up)",
            "Driving / parking nearby",
            "Surprise outing they don't know about",
            "Other",
          ],
        },
        {
          id: "proposalHidingPlan",
          label: "Where should I hide / position myself to stay invisible?",
          type: "textarea",
          required: true,
        },
        {
          id: "proposalSignal",
          label: "Signal you'll give that the moment is about to happen",
          type: "textarea",
          required: true,
          placeholder: "e.g. take off my hat, turn to face them, drop to one knee…",
        },
        {
          id: "proposalAccomplices",
          label: "Anyone else in on it?",
          type: "textarea",
          placeholder: "Witnesses, family hiding nearby, restaurant staff, etc.",
        },
        {
          id: "proposalAfterPlan",
          label:
            "Plan for the portrait session right after — same spot, or move somewhere?",
          type: "textarea",
          required: true,
        },
        {
          id: "proposalRingDetails",
          label: "Ring details / heirloom story to capture (optional)",
          type: "textarea",
        },
        {
          id: "proposalBackupPlan",
          label: "Backup plan if weather doesn't cooperate",
          type: "textarea",
          required: true,
        },
      ],
    },
    {
      title: "Session planning",
      description:
        "The basics for an engagement, anniversary, or non-proposal couples session.",
      showIf: { id: "package", notEquals: "Surprise Proposal" },
      fields: [
        {
          id: "sessionPurpose",
          label: "What's the session for?",
          type: "radio",
          required: true,
          options: [
            "Engagement",
            "Anniversary",
            "Just because",
            "Save-the-date",
            "Other",
          ],
        },
        {
          id: "preferredDateWindow",
          label: "Preferred date window",
          type: "text",
          required: true,
          placeholder: "e.g. mid-October, any weekend in May",
        },
        {
          id: "timeOfDayPref",
          label: "Time of day preference",
          type: "radio",
          required: true,
          options: [
            "Golden hour (sunset)",
            "Blue hour (just after sunset)",
            "Daytime",
            "Soft morning light (6–9am)",
            "No preference",
          ],
        },
        {
          id: "locationIdeas",
          label: "Locations you've been thinking about",
          type: "textarea",
          help: "DC monuments, Rock Creek, Annapolis, Old Town, Brookside Gardens, your favorite coffee shop — anything goes.",
        },
        {
          id: "outfitCount",
          label: "How many outfits are you planning?",
          type: "radio",
          options: ["1 outfit", "2 outfits", "Not sure yet"],
          showIf: { id: "package", notEquals: "Essentials" },
          help: "Essentials is a single-look session — for multiple outfits, take a look at Premium.",
        },
        {
          id: "outfitIdeas",
          label: "Outfit ideas / colors you're considering",
          type: "textarea",
          placeholder: "Neutral colors, pastels, earth tones, etc.",
        },
        {
          id: "propsPetsDetails",
          label: "Props, pets, or details you'd like included",
          type: "textarea",
          placeholder: "Dog, vintage car, picnic, ring box, save-the-date sign…",
        },
        {
          id: "vibeReferences",
          label: "Vibe references (Instagram links, Pinterest board, etc.)",
          type: "textarea",
        },
        {
          id: "inspirationFiles",
          label: "Upload inspiration photos (optional)",
          type: "file",
          help: "Mood-board images, outfit shots, or specific poses you've been saving. Images and PDFs, up to 10 files.",
        },
        {
          id: "nervousAbout",
          label:
            "Anything off-limits or making you nervous about being photographed?",
          type: "textarea",
          help: "The more honest you are here, the better I can pace the session.",
        },
      ],
    },
    {
      title: "Wedding context",
      description:
        "If this session is part of a wedding booking, a few details help me line everything up.",
      showIf: { id: "package", equals: "Premium" },
      fields: [
        {
          id: "partOfWeddingBooking",
          label: "Are you booking this as part of a wedding package?",
          type: "radio",
          options: ["Yes", "No", "Considering"],
        },
        {
          id: "weddingDate",
          label: "Wedding date (if known)",
          type: "date",
        },
        {
          id: "weddingVenueCity",
          label: "Wedding city / venue (if known)",
          type: "text",
        },
        {
          id: "saveTheDateDeadline",
          label:
            "Any save-the-date or invitation deadlines this session needs to feed?",
          type: "textarea",
        },
      ],
    },
    {
      title: "Anything else",
      fields: [
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
// Family Portraits — branches on package size (Premium gets the extras)
// ----------------------------------------------------------------------------

const familyPortraitsQuestionnaire: Questionnaire = {
  slug: "family-portraits",
  title: "Family portrait questionnaire",
  intro:
    "A few questions so the session feels like your family — not a stiff formal portrait. Tell me who's coming, how they show up, and what you'd actually want printed afterward.",
  audience: "Booked and prospective family portrait clients",
  estimatedMinutes: 7,
  sections: [
    yourDetailsSection,
    bookingStatusSection("family-portraits"),
    {
      title: "Your family",
      fields: [
        {
          id: "adultCount",
          label: "Number of adults",
          type: "number",
          required: true,
        },
        {
          id: "kidCount",
          label: "Number of kids",
          type: "number",
          required: true,
        },
        {
          id: "youngKidAges",
          label: "Ages of any kids under 10",
          type: "text",
          placeholder: "e.g. 2, 4, 7",
          help: "Helps me plan the pacing and the bribes (snacks).",
        },
        {
          id: "accessibilityNotes",
          label:
            "Anyone with mobility, sensory, or pacing considerations I should plan around?",
          type: "textarea",
        },
        {
          id: "petsJoining",
          label: "Will any pets be joining?",
          type: "radio",
          options: ["Yes", "No", "Maybe"],
        },
        {
          id: "petDetails",
          label: "Pet details (name, size, temperament around strangers)",
          type: "textarea",
          showIf: { id: "petsJoining", equalsAny: ["Yes", "Maybe"] },
        },
      ],
    },
    {
      title: "Extended family heads-up",
      description:
        "Premium covers larger groups (up to 15) across multiple looks and locations — these questions help me prep for that scale.",
      showIf: { id: "package", equals: "Premium" },
      fields: [
        {
          id: "totalHeadcount",
          label: "Total headcount expected",
          type: "number",
          required: true,
        },
        {
          id: "travelingFamily",
          label: "Are any family members traveling in for this?",
          type: "radio",
          options: YES_NO,
        },
        {
          id: "lastMinuteAdditions",
          label: "Last-minute additions likely?",
          type: "radio",
          options: YES_NO,
        },
        {
          id: "groupCombos",
          label: "Group combos you definitely want",
          type: "textarea",
          required: true,
          placeholder:
            "e.g. all four grandkids with grandma, just the cousins, original five siblings…",
          help: "List the specific combinations you want me to prioritize so we don't miss them.",
        },
      ],
    },
    {
      title: "Wardrobe & looks",
      fields: [
        {
          id: "outfitPalette",
          label: "Outfit color palette / coordination plan",
          type: "textarea",
          placeholder:
            "e.g. earth tones, white and denim, holiday reds — or 'still figuring it out'.",
        },
        {
          id: "outfitChanges",
          label: "Number of outfit changes",
          type: "radio",
          options: ["1 outfit", "2 outfits"],
          showIf: { id: "package", equals: "Premium" },
          help: "Premium is the only tier with two looks built in. Signature and Mini are single-outfit sessions.",
        },
        {
          id: "wardrobeConsult",
          label: "Want a wardrobe consult ahead of the session?",
          type: "radio",
          options: ["Yes please", "I've got it handled"],
          showIf: { id: "package", equals: "Premium" },
          help: "Included in Premium — I can review outfit photos and suggest tweaks before the day.",
        },
        {
          id: "inspirationFiles",
          label: "Upload outfit inspiration (optional)",
          type: "file",
          showIf: { id: "package", equals: "Premium" },
          help: "Outfit photos, color palettes, or family-portrait references you love. Part of the Premium wardrobe consult. Images and PDFs, up to 10 files.",
        },
        {
          id: "wardrobeNervousAbout",
          label: "Anything you're nervous about wearing?",
          type: "textarea",
        },
      ],
    },
    {
      title: "Location & vibe",
      fields: [
        {
          id: "vibe",
          label: "Vibe",
          type: "radio",
          required: true,
          options: [
            "Documentary candid",
            "Posed and polished",
            "Mostly candid with a few group shots",
            "Bring on the chaos",
            "Not sure — open to ideas",
          ],
        },
        {
          id: "indoorOutdoor",
          label: "Indoor or outdoor preference",
          type: "radio",
          options: ["Outdoor", "Indoor", "Mix of both", "No preference"],
        },
        {
          id: "locationIdeas",
          label: "Locations you've been considering",
          type: "textarea",
          placeholder:
            "Park, monument, your home, grandma's backyard, your favorite trail…",
        },
        {
          id: "secondLocation",
          label: "Second location (Premium only)",
          type: "textarea",
          showIf: { id: "package", equals: "Premium" },
          help: "Premium covers 1–2 locations. Tell me about the second one if you have one in mind.",
        },
        {
          id: "timeOfDay",
          label: "Time of day preference",
          type: "radio",
          options: ["Golden hour (sunset)", "Daytime", "Morning light", "No preference"],
        },
      ],
    },
    {
      title: "Logistics",
      fields: [
        {
          id: "preferredDateWindow",
          label: "Preferred date window",
          type: "text",
          required: true,
        },
        {
          id: "backupPlan",
          label: "Backup date / weather plan",
          type: "textarea",
        },
        {
          id: "offLimits",
          label: "Anything off-limits?",
          type: "textarea",
          placeholder:
            "Faces I shouldn't post on social, family members who don't want to be in photos, etc.",
        },
        {
          id: "endUse",
          label: "What will you use the photos for?",
          type: "checkbox",
          options: [
            "Holiday cards",
            "Wall art / prints",
            "Annual update",
            "Social media",
            "Other",
          ],
        },
      ],
    },
    {
      title: "Anything else",
      fields: [
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
// Brand & Commercial — branches wildly different scopes per package
// ----------------------------------------------------------------------------

const brandCommercialQuestionnaire: Questionnaire = {
  slug: "brand-commercial",
  title: "Brand & commercial shoot questionnaire",
  intro:
    "A planning brief so we hit the ground running. Tell me about your brand, where the photos will live, and the specific scope of this shoot — I'll build the shot list around your answers.",
  audience: "Booked and prospective brand / commercial clients",
  estimatedMinutes: 9,
  sections: [
    yourDetailsSection,
    bookingStatusSection("brand-commercial"),
    {
      title: "About the brand",
      fields: [
        {
          id: "brandName",
          label: "Business / brand name",
          type: "text",
          required: true,
        },
        {
          id: "brandWebsite",
          label: "Website",
          type: "text",
          placeholder: "https://",
        },
        {
          id: "brandInstagram",
          label: "Instagram handle",
          type: "text",
          placeholder: "@yourbrand",
        },
        {
          id: "brandOneLiner",
          label: "One-line description of what you do",
          type: "text",
          required: true,
        },
        {
          id: "brandAge",
          label: "How long have you been operating?",
          type: "text",
        },
        {
          id: "workedTogetherBefore",
          label: "Have we worked together before?",
          type: "radio",
          options: YES_NO,
        },
        {
          id: "inspirationFiles",
          label: "Upload brand references, logos, or product shots (optional)",
          type: "file",
          help: "Logo files, existing brand imagery, competitor references, mood boards, or product shots I should study before the shoot. Images and PDFs, up to 10 files.",
        },
      ],
    },
    {
      title: "Where the photos will live",
      description: "Pick everything that applies — it shapes the aspect ratios and edit style.",
      fields: [
        {
          id: "endUse",
          label: "End use",
          type: "checkbox",
          required: true,
          options: [
            "Instagram feed",
            "Instagram stories / reels",
            "Website hero / banners",
            "Product listings (your site / Etsy / Amazon)",
            "Email marketing",
            "Print collateral (flyers, leasing decks, menus)",
            "Press / media kit",
            "Internal use only",
            "Other",
          ],
        },
        {
          id: "endUseOther",
          label: "Tell me more about the 'other' use",
          type: "text",
          showIf: { id: "endUse", equalsAny: ["Other"] },
        },
      ],
    },
    {
      title: "Class / workshop details",
      description:
        "Coverage of a fitness, yoga, or workshop session — instructor, participants, branded space.",
      showIf: {
        id: "package",
        equalsAny: ["Class / Workshop Shoot", "Brand Half-Day"],
      },
      fields: [
        {
          id: "classType",
          label: "Class type",
          type: "radio",
          required: true,
          options: [
            "Yoga",
            "Pilates",
            "HIIT / strength",
            "Dance",
            "Cooking",
            "Workshop",
            "Other",
          ],
        },
        {
          id: "classVenue",
          label: "Studio / venue address",
          type: "textarea",
          required: true,
        },
        {
          id: "classInstructors",
          label: "Instructor name(s)",
          type: "textarea",
          required: true,
        },
        {
          id: "classCount",
          label: "Number of classes to cover",
          type: "number",
          help: "Relevant for Brand Half-Day. Class / Workshop is a single session.",
        },
        {
          id: "classSize",
          label: "Expected class size per session",
          type: "number",
        },
        {
          id: "participantsBriefed",
          label: "Are participants briefed about being photographed?",
          type: "radio",
          required: true,
          options: ["Yes", "No", "I'll handle it before the shoot"],
        },
        {
          id: "modelReleases",
          label: "Model releases needed for participants?",
          type: "radio",
          options: ["Yes", "No", "I'll provide my own"],
        },
        {
          id: "classMoments",
          label: "Specific moments / poses to capture",
          type: "textarea",
          placeholder:
            "e.g. the partner stretch, savasana wide shot, instructor hands-on adjustment…",
        },
        {
          id: "instructorPortraits",
          label:
            "Should I include instructor portrait coverage in the same block?",
          type: "radio",
          options: YES_NO,
        },
      ],
    },
    {
      title: "Product / lifestyle details",
      description:
        "Flatlay or in-context product photography — for catalog, marketing, or content series.",
      showIf: {
        id: "package",
        equalsAny: ["Product / Lifestyle", "Brand Half-Day"],
      },
      fields: [
        {
          id: "skuCount",
          label: "Number of SKUs to shoot",
          type: "number",
          required: true,
          help: "Product / Lifestyle covers up to 15 SKUs. Additional SKUs are $75 per 5.",
        },
        {
          id: "styleMix",
          label: "Style mix",
          type: "radio",
          required: true,
          options: [
            "All flatlay",
            "All in-context lifestyle",
            "Mix of both",
          ],
        },
        {
          id: "artDirection",
          label: "Will you be on set to art-direct?",
          type: "radio",
          options: ["Yes", "No", "Sending a stylist"],
        },
        {
          id: "stylingMaterials",
          label: "Props / styling materials — who's bringing what?",
          type: "textarea",
        },
        {
          id: "backgroundPref",
          label: "Background preferences",
          type: "checkbox",
          options: [
            "White seamless",
            "Wood",
            "Linen",
            "Colored seamless",
            "On-location",
            "Multiple backgrounds",
          ],
        },
        {
          id: "colorPalette",
          label: "Color palette / mood references",
          type: "textarea",
        },
        {
          id: "modelsInFrame",
          label: "Models or hands needed in frame?",
          type: "radio",
          options: YES_NO,
        },
        {
          id: "aspectRatios",
          label: "Final aspect ratios needed",
          type: "checkbox",
          options: [
            "1:1 square",
            "4:5 portrait",
            "9:16 vertical",
            "16:9 landscape",
            "3:2 standard",
          ],
        },
      ],
    },
    {
      title: "Storefront / instructor mini",
      description:
        "Brand Mini is a focused 45-minute session — one location, one deliverable.",
      showIf: { id: "package", equals: "Brand Mini" },
      fields: [
        {
          id: "miniWhat",
          label: "What are we shooting?",
          type: "radio",
          required: true,
          options: [
            "Instructor portrait",
            "Storefront promo",
            "Single-product feature",
            "New menu item",
            "Other",
          ],
        },
        {
          id: "miniLocation",
          label: "Location address",
          type: "textarea",
          required: true,
        },
        {
          id: "miniWardrobe",
          label: "Wardrobe / styling plan",
          type: "textarea",
        },
        {
          id: "miniHeroDeliverable",
          label: "The single deliverable you most need",
          type: "text",
          required: true,
          help: "If we only nail one shot, what is it?",
        },
      ],
    },
    {
      title: "Brand half-day planning",
      description:
        "The 4-hour scope deserves a real run of show — let's plan it.",
      showIf: { id: "package", equals: "Brand Half-Day" },
      fields: [
        {
          id: "runOfShow",
          label: "Rough hour-by-hour plan",
          type: "textarea",
          required: true,
          placeholder:
            "9-10am: studio hero shots\n10-11am: instructor portraits\n11-12pm: class action\n12-1pm: detail / product flatlays",
        },
        {
          id: "halfDayLocations",
          label: "Locations you'll need me at",
          type: "textarea",
          placeholder: "Single studio, or multiple stops? List addresses.",
        },
        {
          id: "sameDaySocialSelects",
          label: "Same-day social selects needed?",
          type: "radio",
          options: YES_NO,
          help: "Brand Half-Day includes up to 15 same-day selects.",
        },
        {
          id: "verticalReelsAddon",
          label: "Interested in the vertical reels / BTS clips add-on?",
          type: "radio",
          options: ["Yes", "No", "Maybe"],
        },
      ],
    },
    {
      title: "Deadline & deliverables",
      fields: [
        {
          id: "finalDeadline",
          label: "When do you need final photos by?",
          type: "date",
          required: true,
        },
        {
          id: "rushGallery",
          label: "Interested in the 24-hour rush gallery add-on?",
          type: "radio",
          options: ["Yes", "No", "Maybe"],
        },
        {
          id: "fileFormats",
          label: "File formats needed",
          type: "radio",
          options: ["Web only", "Print only", "Both web and print"],
        },
        {
          id: "recurringPotential",
          label: "Recurring schedule potential",
          type: "radio",
          options: [
            "One-off",
            "Monthly",
            "Quarterly",
            "Ongoing",
          ],
          help: "Recurring schedules qualify for a discounted retainer rate.",
        },
      ],
    },
    {
      title: "Anything else",
      fields: [
        {
          id: "brandGuidelines",
          label: "Brand guidelines URL (optional)",
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
// Registry
// ----------------------------------------------------------------------------

export const QUESTIONNAIRES: Partial<Record<ServiceSlug, Questionnaire>> = {
  "weddings": weddingQuestionnaire,
  "engagements-couples": engagementsCouplesQuestionnaire,
  "cultural-milestones": culturalMilestonesQuestionnaire,
  "family-portraits": familyPortraitsQuestionnaire,
  "family-celebrations": familyCelebrationsQuestionnaire,
  "corporate-community-events": corporateEventsQuestionnaire,
  "brand-commercial": brandCommercialQuestionnaire,
  "concerts-performances": concertsPerformancesQuestionnaire,
  "maternity": maternityQuestionnaire,
  "newborn": newbornQuestionnaire,
  "portraiture": portraitureQuestionnaire,
  "graduation": graduationQuestionnaire,
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
