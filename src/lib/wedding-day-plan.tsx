// Wedding Day Plan — branded PDF generated from questionnaire answers.
//
// Uses @react-pdf/renderer to produce a multi-page PDF that Julian can print
// and hand to his second shooter, or share with the couple. The PDF is attached
// to the questionnaire email and downloadable from the success screen.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

// ---------------------------------------------------------------------------
// Font registration — variable TTFs bundled in public/fonts/
// ---------------------------------------------------------------------------

const fontsDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Playfair",
  fonts: [
    { src: path.join(fontsDir, "PlayfairDisplay-Variable.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "PlayfairDisplay-Variable.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontsDir, "Inter-Variable.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Inter-Variable.ttf"), fontWeight: 500 },
  ],
});

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const ACCENT = "#8a6e4b";
const FOREGROUND = "#0e0e0e";
const MUTED = "#6b6b6b";
const BORDER = "#e7e4dd";

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: FOREGROUND,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
  // Cover
  coverPage: {
    fontFamily: "Inter",
    color: FOREGROUND,
    paddingHorizontal: 48,
    paddingVertical: 48,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  coverBrand: {
    fontFamily: "Playfair",
    fontSize: 18,
    color: FOREGROUND,
    marginBottom: 4,
  },
  coverRule: {
    width: 60,
    height: 2,
    backgroundColor: ACCENT,
    marginBottom: 48,
  },
  coverTitle: {
    fontFamily: "Playfair",
    fontSize: 32,
    color: FOREGROUND,
    marginBottom: 16,
  },
  coverMeta: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  // Section headers
  sectionHeader: {
    fontFamily: "Playfair",
    fontSize: 16,
    color: FOREGROUND,
    marginBottom: 4,
  },
  sectionRule: {
    height: 1.5,
    backgroundColor: ACCENT,
    marginBottom: 16,
    width: 40,
  },
  // Content
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  label: {
    fontSize: 9,
    color: MUTED,
    width: 160,
    flexShrink: 0,
  },
  value: {
    fontSize: 10,
    color: FOREGROUND,
    flex: 1,
    lineHeight: 1.5,
  },
  // Timeline table
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: ACCENT,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableColEvent: {
    width: "60%",
    fontSize: 9,
    color: MUTED,
  },
  tableColTime: {
    width: "40%",
    fontSize: 9,
    color: MUTED,
  },
  tableEventVal: {
    width: "60%",
    fontSize: 10,
    color: FOREGROUND,
  },
  tableTimeVal: {
    width: "40%",
    fontSize: 10,
    color: FOREGROUND,
    fontWeight: 500,
  },
  // Checklist
  checkItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 1,
    marginRight: 8,
    marginTop: 1,
  },
  checkboxChecked: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: ACCENT,
    borderRadius: 1,
    marginRight: 8,
    marginTop: 1,
  },
  checkLabel: {
    fontSize: 10,
    color: FOREGROUND,
    flex: 1,
    lineHeight: 1.5,
  },
  // Notes
  noteBlock: {
    backgroundColor: "#f8f7f4",
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 10,
    color: FOREGROUND,
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  // Input is HH:MM from <input type="time">, convert to 12h
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Section header component
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={s.sectionHeader}>{title}</Text>
      <View style={s.sectionRule} />
    </View>
  );
}

function CheckItem({
  label,
  checked = false,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <View style={s.checkItem}>
      <View style={checked ? s.checkboxChecked : s.checkbox} />
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function PageFooter({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Julian Perez Photography</Text>
      <Text style={s.footerText}>{pageLabel}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function WeddingDayPlan({ answers }: { answers: Answers }) {
  const coupleName = `${a(answers, "fullName")} & ${a(answers, "partnerFullName")}`;
  const eventDate = a(answers, "eventDate");
  const ceremonyVenue = a(answers, "ceremonyVenue").split("\n")[0];
  const isMini = a(answers, "package") === "Mini";

  // Timeline entries
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

  // Shot preferences
  const detailPhotos = aList(answers, "detailPhotos");
  const ceremonyMoments = aList(answers, "ceremonyMoments");
  const receptionMoments = aList(answers, "receptionMoments");

  // Family portrait info
  const familyPlanned = a(answers, "familyPortraitsPlanned");
  const noFamilyPortraits = familyPlanned === "No formal family portraits";
  const brideName = a(answers, "fullName").split(" ")[0] || "Partner 1";
  const groomName = a(answers, "partnerFullName").split(" ")[0] || "Partner 2";
  const brideParents = a(answers, "brideParentsNames");
  const groomParents = a(answers, "groomParentsNames");
  const brideSiblings = a(answers, "brideSiblingsNames");
  const groomSiblings = a(answers, "groomSiblingsNames");
  const grandparents = a(answers, "grandparentsNames");
  const additionalGroupings = a(answers, "additionalFamilyGroupings");

  // Auto-generate grouping list
  const familyGroupings: string[] = [];
  if (brideParents) {
    familyGroupings.push(`Couple with ${brideParents}`);
    familyGroupings.push(`${brideName} with ${brideParents}`);
  }
  if (groomParents) {
    familyGroupings.push(`Couple with ${groomParents}`);
    familyGroupings.push(`${groomName} with ${groomParents}`);
  }
  if (brideParents && groomParents) {
    familyGroupings.push("Couple with both sets of parents");
  }
  if (brideSiblings) {
    familyGroupings.push(`Couple with ${brideName}'s siblings (${brideSiblings})`);
  }
  if (groomSiblings) {
    familyGroupings.push(`Couple with ${groomName}'s siblings (${groomSiblings})`);
  }
  if (grandparents) {
    for (const line of grandparents.split("\n").filter(Boolean)) {
      familyGroupings.push(`Couple with ${line.trim()}`);
    }
  }
  if (additionalGroupings) {
    for (const line of additionalGroupings.split("\n").filter(Boolean)) {
      familyGroupings.push(line.trim());
    }
  }

  return (
    <Document>
      {/* ── Page 1: Cover ── */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverBrand}>Julian Perez Photography</Text>
        <View style={s.coverRule} />
        <Text style={s.coverTitle}>Wedding Day Plan</Text>
        <Text style={s.coverMeta}>{coupleName}</Text>
        {eventDate && <Text style={s.coverMeta}>{eventDate}</Text>}
        {ceremonyVenue && <Text style={s.coverMeta}>{ceremonyVenue}</Text>}
      </Page>

      {/* ── Page 2: Timeline ── */}
      {timeline.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <SectionHeader title="Timeline" />
          <View style={s.tableHeader}>
            <Text style={s.tableColEvent}>Event</Text>
            <Text style={s.tableColTime}>Time</Text>
          </View>
          {timeline.map(([event, time]) => (
            <View key={event} style={s.tableRow}>
              <Text style={s.tableEventVal}>{event}</Text>
              <Text style={s.tableTimeVal}>{time}</Text>
            </View>
          ))}
          {a(answers, "timelineNotes") && (
            <View style={s.noteBlock}>
              <Text style={{ fontSize: 9, color: MUTED, marginBottom: 4 }}>
                Timeline notes
              </Text>
              <Text style={s.noteText}>
                {a(answers, "timelineNotes")}
              </Text>
            </View>
          )}
          <PageFooter pageLabel="Timeline" />
        </Page>
      )}

      {/* ── Page 3: Venues & Logistics ── */}
      <Page size="LETTER" style={s.page}>
        <SectionHeader title="Venues & Logistics" />
        <Field
          label="Getting-ready location"
          value={a(answers, "gettingReadyAddress")}
        />
        <Field
          label="Partner getting-ready"
          value={a(answers, "partnerGettingReadyAddress")}
        />
        <Field label="Ceremony venue" value={a(answers, "ceremonyVenue")} />
        <Field
          label="Indoor / outdoor"
          value={a(answers, "ceremonyIndoorOutdoor")}
        />
        <Field
          label="Ceremony restrictions"
          value={a(answers, "ceremonyRestrictions")}
        />
        <Field
          label="Cocktail hour location"
          value={a(answers, "cocktailHourLocation")}
        />
        {!isMini && (
          <>
            <Field
              label="Reception venue"
              value={a(answers, "receptionVenue")}
            />
            <Field label="Guest count" value={a(answers, "guestCount")} />
            <Field
              label="Vendor meals provided"
              value={a(answers, "vendorMeals")}
            />
          </>
        )}
        <PageFooter pageLabel="Venues & Logistics" />
      </Page>

      {/* ── Page 4: Shot Preferences — Details & Getting Ready ── */}
      <Page size="LETTER" style={s.page}>
        <SectionHeader title="Shot Preferences — Details & Getting Ready" />

        {detailPhotos.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ fontSize: 9, color: MUTED, marginBottom: 8 }}
            >
              Detail photos to prioritize
            </Text>
            {detailPhotos.map((item) => (
              <CheckItem key={item} label={item} checked />
            ))}
          </View>
        )}

        <Field
          label="Getting-ready coverage"
          value={a(answers, "gettingReady")}
        />
        <Field label="First look / first touch" value={a(answers, "firstLook")} />
        <Field label="First look with" value={a(answers, "firstLookWith")} />
        <Field
          label="Wedding party"
          value={a(answers, "weddingParty")}
        />
        <Field
          label="Must-take photos"
          value={a(answers, "mustTakePhotos")}
        />
        <Field
          label="Unique / cultural elements"
          value={a(answers, "uniqueElements")}
        />

        <PageFooter pageLabel="Details & Getting Ready" />
      </Page>

      {/* ── Page 5: Shot Preferences — Ceremony & Reception ── */}
      <Page size="LETTER" style={s.page}>
        <SectionHeader title="Shot Preferences — Ceremony & Reception" />

        {ceremonyMoments.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ fontSize: 9, color: MUTED, marginBottom: 8 }}
            >
              Ceremony moments to prioritize
            </Text>
            {ceremonyMoments.map((item) => (
              <CheckItem key={item} label={item} checked />
            ))}
          </View>
        )}

        {receptionMoments.length > 0 && !isMini && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ fontSize: 9, color: MUTED, marginBottom: 8 }}
            >
              Reception moments to prioritize
            </Text>
            {receptionMoments.map((item) => (
              <CheckItem key={item} label={item} checked />
            ))}
          </View>
        )}

        {!isMini && (
          <>
            <Field
              label="Special dances"
              value={aList(answers, "specialDances").join(", ")}
            />
            <Field label="Speeches / toasts" value={a(answers, "speeches")} />
            <Field label="Cake cutting" value={a(answers, "cakeCutting")} />
            <Field
              label="Special entrance"
              value={a(answers, "specialEntrance")}
            />
            <Field
              label="Sunset portraits"
              value={a(answers, "sunsetPortraits")}
            />
            <Field label="Formal exit" value={a(answers, "formalExit")} />
          </>
        )}

        <PageFooter pageLabel="Ceremony & Reception" />
      </Page>

      {/* ── Page 6: Family Portraits (skip if no formal portraits) ── */}
      {!isMini && !noFamilyPortraits && familyGroupings.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <SectionHeader title="Family Portraits" />
          <Text style={{ fontSize: 9, color: MUTED, marginBottom: 12 }}>
            {familyPlanned}
          </Text>
          {familyGroupings.map((grouping) => (
            <CheckItem key={grouping} label={grouping} />
          ))}
          {a(answers, "familyPortraitNotes") && (
            <View style={s.noteBlock}>
              <Text style={{ fontSize: 9, color: MUTED, marginBottom: 4 }}>
                Notes
              </Text>
              <Text style={s.noteText}>
                {a(answers, "familyPortraitNotes")}
              </Text>
            </View>
          )}
          <PageFooter pageLabel="Family Portraits" />
        </Page>
      )}

      {/* ── Page 7: Notes & Special Requests ── */}
      <Page size="LETTER" style={s.page}>
        <SectionHeader title="Notes & Special Requests" />
        <Field
          label="Additional reception notes"
          value={a(answers, "additionalReception")}
        />
        <Field label="How they found me" value={a(answers, "referral")} />
        <Field label="Anything else" value={a(answers, "anythingElse")} />

        {/* Elopement details for Mini */}
        {isMini && (
          <>
            <View style={{ marginTop: 16 }} />
            <Field
              label="Guests attending"
              value={a(answers, "elopementWitnesses")}
            />
            <Field
              label="Portrait time"
              value={a(answers, "elopementPortraitTime")}
            />
            <Field
              label="Outfit change"
              value={a(answers, "elopementOutfitChange")}
            />
          </>
        )}

        <PageFooter pageLabel="Notes" />
      </Page>
    </Document>
  );
}
