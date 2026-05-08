// Wedding Films Plan — branded PDF generated from the wedding-films
// questionnaire answers. Parallel to `wedding-day-plan.tsx`, scoped to
// the questions a videographer actually needs at production time
// (lead-role, ceremony audio setup, multi-cam ceremony length,
// interview prep, music selections, drone permissions). Attached to
// the questionnaire confirmation email and downloadable from the
// success screen.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

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

const ACCENT = "#8a6e4b";
const FOREGROUND = "#0e0e0e";
const MUTED = "#6b6b6b";

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: FOREGROUND,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
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
  paragraph: {
    fontSize: 10,
    color: FOREGROUND,
    lineHeight: 1.55,
    marginBottom: 8,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: ACCENT,
    marginRight: 8,
  },
  checkboxChecked: {
    width: 9,
    height: 9,
    backgroundColor: ACCENT,
    marginRight: 8,
  },
  checkLabel: {
    fontSize: 10,
    color: FOREGROUND,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
  footerText: { fontSize: 8, color: MUTED },
});

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
  if (Number.isNaN(hour)) return t;
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={s.sectionHeader}>{title}</Text>
      <View style={s.sectionRule} />
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

function Paragraph({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.paragraph, { marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function PageFooter({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Julian Perez Photography — Wedding Films</Text>
      <Text style={s.footerText}>{pageLabel}</Text>
    </View>
  );
}

const AUDIO_OPTIONS = [
  "Officiant available for a lapel mic",
  "Groom / partner available for a lapel mic",
  "DJ provides a board feed for reception speeches",
  "Live band performing (will need a separate mic plan)",
  "Acoustic ceremony only (no amplification)",
  "Outdoor ceremony — wind / ambient noise considerations",
];

export function WeddingFilmsPlan({ answers }: { answers: Answers }) {
  const coupleName = [
    a(answers, "fullName"),
    a(answers, "partnerFullName"),
  ]
    .filter(Boolean)
    .join(" & ");
  const eventDate = a(answers, "eventDate");
  const venueName = a(answers, "venueName");
  const tier = a(answers, "package");
  const audioFlags = aList(answers, "audioSetup");

  const interviewTiers = ["Story Film", "Cinematic", "Signature Film"];
  const droneTiers = ["Cinematic", "Signature Film"];
  const showInterviews = interviewTiers.includes(tier);
  const showDrone = droneTiers.includes(tier);

  return (
    <Document>
      {/* Cover */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverBrand}>Julian Perez Photography</Text>
        <View style={s.coverRule} />
        <Text style={s.coverTitle}>{coupleName || "Wedding Films Plan"}</Text>
        {eventDate && <Text style={s.coverMeta}>Wedding date: {eventDate}</Text>}
        {venueName && <Text style={s.coverMeta}>Venue: {venueName}</Text>}
        {tier && <Text style={s.coverMeta}>Coverage: {tier}</Text>}
        <View style={{ marginTop: 32 }}>
          <Text style={[s.coverMeta, { fontSize: 10 }]}>
            Wedding Films planning summary — generated from your questionnaire
            answers. Bring this to the consult call so we can lock the lead-role
            decision, audio plan, and ceremony coverage strategy.
          </Text>
        </View>
      </Page>

      {/* Body */}
      <Page size="LETTER" style={s.page}>
        <SectionHeader title="Coverage overview" />
        <Field label="Couple" value={coupleName} />
        <Field label="Wedding date" value={eventDate} />
        <Field label="Venue" value={venueName} />
        <Field label="Venue address" value={a(answers, "venueAddress")} />
        <Field label="Tier" value={tier} />
        <Field
          label="Lead role"
          value={a(answers, "leadRolePreference")}
        />
        <Field
          label="Getting ready start"
          value={formatTime(a(answers, "gettingReadyStart"))}
        />
        <Field
          label="Ceremony start"
          value={formatTime(a(answers, "ceremonyStart"))}
        />
        <Field
          label="Reception end"
          value={formatTime(a(answers, "receptionEnd"))}
        />

        <SectionHeader title="Ceremony" />
        <Field label="Ceremony type" value={a(answers, "ceremonyType")} />
        <Field
          label="Expected length"
          value={a(answers, "expectedCeremonyLength")}
        />
        <Paragraph
          label="Cultural / multilingual elements"
          value={a(answers, "culturalElements")}
        />

        <SectionHeader title="Audio setup" />
        <View style={{ marginBottom: 12 }}>
          {AUDIO_OPTIONS.map((opt) => (
            <View key={opt} style={s.checkItem}>
              <View
                style={
                  audioFlags.includes(opt) ? s.checkboxChecked : s.checkbox
                }
              />
              <Text style={s.checkLabel}>{opt}</Text>
            </View>
          ))}
        </View>
        <Paragraph
          label="Notes on venue audio"
          value={a(answers, "audioNotes")}
        />

        {showDrone && (
          <>
            <SectionHeader title="Drone footage" />
            <Field
              label="Venue allowance"
              value={a(answers, "droneAllowed")}
            />
          </>
        )}

        <SectionHeader title="Reception structure" />
        <Paragraph label="Speakers" value={a(answers, "speakers")} />
        <Paragraph label="Dance order" value={a(answers, "danceOrder")} />
        <Paragraph
          label="Other special moments"
          value={a(answers, "specialReceptionElements")}
        />

        {showInterviews && (
          <>
            <SectionHeader title="Pre-wedding interview prep" />
            <Paragraph label="How you met" value={a(answers, "howWeMet")} />
            <Paragraph
              label="The proposal"
              value={a(answers, "proposalStory")}
            />
            <Paragraph
              label="What you want said in the film"
              value={a(answers, "filmMessage")}
            />
            <Paragraph
              label="Bridal-party interview wishlist"
              value={a(answers, "bridalPartyInterview")}
            />
            <Paragraph
              label="Sit-down scheduling preferences"
              value={a(answers, "interviewSchedulingPreference")}
            />
          </>
        )}

        <SectionHeader title="Music and tone" />
        <Paragraph
          label="Songs you'd love to hear"
          value={a(answers, "musicLove")}
        />
        <Paragraph label="Songs to avoid" value={a(answers, "musicAvoid")} />
        <Field label="Mood keywords" value={a(answers, "moodKeywords")} />

        <SectionHeader title="Sharing and delivery" />
        <Field label="Sharing intent" value={a(answers, "sharingIntent")} />
        <Field
          label="Raw footage"
          value={a(answers, "rawFootageDelivery")}
        />

        <SectionHeader title="Vendor coordination" />
        <Paragraph
          label="Separate photographer (Solo bookings)"
          value={a(answers, "separatePhotographer")}
        />
        <Paragraph
          label="Planner / coordinator"
          value={a(answers, "plannerContact")}
        />
        <Paragraph
          label="Venue day-of contact"
          value={a(answers, "venueContact")}
        />

        {a(answers, "anythingElse") && (
          <>
            <SectionHeader title="Anything else" />
            <Text style={s.paragraph}>{a(answers, "anythingElse")}</Text>
          </>
        )}

        <PageFooter pageLabel="Page 2" />
      </Page>
    </Document>
  );
}
