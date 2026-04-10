// Google Docs integration — creates a shared, editable Wedding Day Plan doc
// from questionnaire answers. Both Julian and the client get editor access.
//
// Gracefully degrades: if credentials are missing or the API call fails, the
// submission still succeeds — the email + PDF are the primary deliverables.

import { google } from "googleapis";

type Answers = Record<string, string | string[] | undefined>;

function a(answers: Answers, key: string): string {
  const v = answers[key];
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function aList(answers: Answers, key: string): string[] {
  const v = answers[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [];
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null;

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export async function createWeddingPlanDoc(opts: {
  coupleName: string;
  eventDate: string;
  answers: Answers;
  shareWith: string[];
}): Promise<string | null> {
  const auth = getAuth();
  if (!auth) {
    console.log(
      "[google-docs] GOOGLE_SERVICE_ACCOUNT_EMAIL or PRIVATE_KEY not set — skipping Google Doc creation",
    );
    return null;
  }

  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });
  const { coupleName, eventDate, answers } = opts;
  const isMini = a(answers, "package") === "Mini";

  // ── Create a blank document ──

  const createRes = await docs.documents.create({
    requestBody: {
      title: `Wedding Day Plan — ${coupleName} — ${eventDate}`,
    },
  });
  const docId = createRes.data.documentId!;

  // ── Build content via batchUpdate ──
  // Google Docs API inserts at an index and everything shifts. We build the
  // content bottom-up so indices don't drift, OR we insert sequentially and
  // track the running index. We'll do the latter.

  // Build text blocks as an array, then insert them in one batchUpdate.
  const blocks: string[] = [];

  // Cover
  blocks.push("Julian Perez Photography\n");
  blocks.push("Wedding Day Plan\n\n");
  blocks.push(`${coupleName}\n`);
  if (eventDate) blocks.push(`${eventDate}\n`);
  const ceremonyVenue = a(answers, "ceremonyVenue").split("\n")[0];
  if (ceremonyVenue) blocks.push(`${ceremonyVenue}\n`);
  blocks.push("\n");

  // Timeline
  const timeline: [string, string][] = [
    ["Photo / video start", formatTime(a(answers, "photoStartTime"))],
    ["Getting ready", formatTime(a(answers, "gettingReadyTime"))],
    ["First look / first touch", formatTime(a(answers, "firstLookTime"))],
    ["Ceremony", formatTime(a(answers, "ceremonyStartTime"))],
    ["Cocktail hour", formatTime(a(answers, "cocktailHourTime"))],
    ["Reception", formatTime(a(answers, "receptionStartTime"))],
    ["Sunset session", formatTime(a(answers, "sunsetTime"))],
    ["Sendoff", formatTime(a(answers, "sendoffTime"))],
  ].filter(([, time]) => time) as [string, string][];

  if (timeline.length > 0) {
    blocks.push("TIMELINE\n\n");
    for (const [event, time] of timeline) {
      blocks.push(`${event}: ${time}\n`);
    }
    const timelineNotes = a(answers, "timelineNotes");
    if (timelineNotes) blocks.push(`\nNotes: ${timelineNotes}\n`);
    blocks.push("\n");
  }

  // Venues
  blocks.push("VENUES & LOGISTICS\n\n");
  const venueFields: [string, string][] = [
    ["Getting-ready location", a(answers, "gettingReadyAddress")],
    ["Partner getting-ready", a(answers, "partnerGettingReadyAddress")],
    ["Ceremony venue", a(answers, "ceremonyVenue")],
    ["Indoor / outdoor", a(answers, "ceremonyIndoorOutdoor")],
    ["Ceremony restrictions", a(answers, "ceremonyRestrictions")],
    ["Cocktail hour location", a(answers, "cocktailHourLocation")],
    ["Reception venue", a(answers, "receptionVenue")],
    ["Guest count", a(answers, "guestCount")],
    ["Vendor meals", a(answers, "vendorMeals")],
  ];
  for (const [label, value] of venueFields) {
    if (value) blocks.push(`${label}: ${value}\n`);
  }
  blocks.push("\n");

  // Shot preferences
  blocks.push("SHOT PREFERENCES\n\n");
  const detailPhotos = aList(answers, "detailPhotos");
  if (detailPhotos.length > 0) {
    blocks.push("Detail photos:\n");
    for (const item of detailPhotos) blocks.push(`  ☑ ${item}\n`);
    blocks.push("\n");
  }
  const ceremonyMoments = aList(answers, "ceremonyMoments");
  if (ceremonyMoments.length > 0) {
    blocks.push("Ceremony moments:\n");
    for (const item of ceremonyMoments) blocks.push(`  ☑ ${item}\n`);
    blocks.push("\n");
  }
  const receptionMoments = aList(answers, "receptionMoments");
  if (receptionMoments.length > 0 && !isMini) {
    blocks.push("Reception moments:\n");
    for (const item of receptionMoments) blocks.push(`  ☑ ${item}\n`);
    blocks.push("\n");
  }

  const shotFields: [string, string][] = [
    ["Wedding party", a(answers, "weddingParty")],
    ["Must-take photos", a(answers, "mustTakePhotos")],
    ["Unique elements", a(answers, "uniqueElements")],
    ["First look", a(answers, "firstLook")],
    ["Special dances", aList(answers, "specialDances").join(", ")],
    ["Speeches", a(answers, "speeches")],
    ["Cake cutting", a(answers, "cakeCutting")],
    ["Sunset portraits", a(answers, "sunsetPortraits")],
    ["Formal exit", a(answers, "formalExit")],
  ];
  for (const [label, value] of shotFields) {
    if (value) blocks.push(`${label}: ${value}\n`);
  }
  blocks.push("\n");

  // Family portraits
  const familyPlanned = a(answers, "familyPortraitsPlanned");
  if (familyPlanned && familyPlanned !== "No formal family portraits" && !isMini) {
    blocks.push("FAMILY PORTRAITS\n\n");
    blocks.push(`Plan: ${familyPlanned}\n\n`);

    const brideName = a(answers, "fullName").split(" ")[0] || "Partner 1";
    const groomName =
      a(answers, "partnerFullName").split(" ")[0] || "Partner 2";
    const brideParents = a(answers, "brideParentsNames");
    const groomParents = a(answers, "groomParentsNames");
    const brideSiblings = a(answers, "brideSiblingsNames");
    const groomSiblings = a(answers, "groomSiblingsNames");
    const grandparents = a(answers, "grandparentsNames");
    const additional = a(answers, "additionalFamilyGroupings");

    if (brideParents) {
      blocks.push(`☐ Couple with ${brideParents}\n`);
      blocks.push(`☐ ${brideName} with ${brideParents}\n`);
    }
    if (groomParents) {
      blocks.push(`☐ Couple with ${groomParents}\n`);
      blocks.push(`☐ ${groomName} with ${groomParents}\n`);
    }
    if (brideParents && groomParents) {
      blocks.push("☐ Couple with both sets of parents\n");
    }
    if (brideSiblings) {
      blocks.push(
        `☐ Couple with ${brideName}'s siblings (${brideSiblings})\n`,
      );
    }
    if (groomSiblings) {
      blocks.push(
        `☐ Couple with ${groomName}'s siblings (${groomSiblings})\n`,
      );
    }
    if (grandparents) {
      for (const line of grandparents.split("\n").filter(Boolean)) {
        blocks.push(`☐ Couple with ${line.trim()}\n`);
      }
    }
    if (additional) {
      for (const line of additional.split("\n").filter(Boolean)) {
        blocks.push(`☐ ${line.trim()}\n`);
      }
    }

    const familyNotes = a(answers, "familyPortraitNotes");
    if (familyNotes) blocks.push(`\nNotes: ${familyNotes}\n`);
    blocks.push("\n");
  }

  // Notes
  blocks.push("NOTES & SPECIAL REQUESTS\n\n");
  const noteFields: [string, string][] = [
    ["Additional reception notes", a(answers, "additionalReception")],
    ["How they found me", a(answers, "referral")],
    ["Anything else", a(answers, "anythingElse")],
  ];
  for (const [label, value] of noteFields) {
    if (value) blocks.push(`${label}: ${value}\n`);
  }

  // Join all blocks into one string and insert at index 1 (after the implicit
  // empty paragraph that every new Google Doc starts with).
  const fullText = blocks.join("");

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullText,
          },
        },
      ],
    },
  });

  // ── Apply heading styles ──
  // Find the positions of section headers in the full text and style them.
  const headingPatterns = [
    "Julian Perez Photography",
    "Wedding Day Plan",
    "TIMELINE",
    "VENUES & LOGISTICS",
    "SHOT PREFERENCES",
    "FAMILY PORTRAITS",
    "NOTES & SPECIAL REQUESTS",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleRequests: any[] = [];
  for (const heading of headingPatterns) {
    const idx = fullText.indexOf(heading);
    if (idx === -1) continue;
    const startIndex = idx + 1; // +1 for the implicit first character
    const endIndex = startIndex + heading.length;

    if (heading === "Julian Perez Photography") {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType: "HEADING_1" },
          fields: "namedStyleType",
        },
      });
    } else if (heading === "Wedding Day Plan") {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType: "HEADING_1" },
          fields: "namedStyleType",
        },
      });
    } else {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType: "HEADING_2" },
          fields: "namedStyleType",
        },
      });
    }

    // Color section headers gold
    if (heading.startsWith("TIMELINE") || heading.startsWith("VENUES") || heading.startsWith("SHOT") || heading.startsWith("FAMILY") || heading.startsWith("NOTES")) {
      styleRequests.push({
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle: {
            foregroundColor: {
              color: {
                rgbColor: {
                  red: 0x8a / 255,
                  green: 0x6e / 255,
                  blue: 0x4b / 255,
                },
              },
            },
          },
          fields: "foregroundColor",
        },
      });
    }
  }

  if (styleRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: styleRequests },
    });
  }

  // ── Share with both parties ──

  for (const email of opts.shareWith) {
    if (!email) continue;
    try {
      await drive.permissions.create({
        fileId: docId,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: email,
        },
      });
    } catch (err) {
      console.error(
        `[google-docs] Failed to share with ${email}:`,
        err,
      );
    }
  }

  return `https://docs.google.com/document/d/${docId}/edit`;
}
