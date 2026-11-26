// Every environment setting the site reads, in one list: what it's for, what
// goes without it, and whether a production deploy needs it. The boot log, the
// admin Setup card, .env.example and docs/configuration.md all come from here
// (npm run env:docs regenerates the last two; a spec checks they're current).
// Plain data with no imports, so the docs script can load it directly.

export type Setting = {
  name: string;
  area: string;
  purpose: string;
  // What stops working without it ("" when it's optional polish).
  without: string;
  neededInProd?: boolean;
  example?: string;
};

export const SETTINGS: Setting[] = [
  // Email
  { area: "Email", name: "RESEND_API_KEY", purpose: "Sends every email (inquiries, confirmations, sign-in links, client messages).", without: "No email goes out; in production, forms report an error instead of pretending to send.", neededInProd: true, example: "re_..." },
  { area: "Email", name: "RESEND_FROM", purpose: "The verified sender address.", without: "", example: "Julian Perez Photography <noreply@julianperezphotography.com>" },
  { area: "Email", name: "INQUIRY_TO", purpose: "Where owner alerts go (new inquiries, forwarded client replies).", without: "Owner alerts go to the contact email in Sanity site settings." },
  { area: "Email", name: "RESEND_INBOUND_DOMAIN", purpose: "The receiving subdomain for client replies (reply+<token>@ and log+<token>@).", without: "Replies go straight to your inbox and don't appear on the project thread.", example: "in.julianperezphotography.com" },
  { area: "Email", name: "RESEND_WEBHOOK_SECRET", purpose: "Verifies Resend's delivery and inbound events at /api/email/webhook.", without: "No delivery status or replies on project threads (the webhook refuses everything).", example: "whsec_..." },
  { area: "Email", name: "DEV_EMAIL_TO", purpose: "Where preview and local builds send email instead of the real recipient.", without: "Those builds send to the first ADMIN_EMAIL." },
  { area: "Email", name: "NOTIFY_CLIENT_EDITS", purpose: "Set to false to stop the emails when a client edits their portal details, starts a project or uploads a file.", without: "" },
  // Client store and sign-in
  { area: "Clients and sign-in", name: "SUPABASE_URL", purpose: "The private client store (projects, messages, settings).", without: "No client records, portal, admin projects or message threads.", neededInProd: true, example: "https://<ref>.supabase.co" },
  { area: "Clients and sign-in", name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Server-only key for the client store.", without: "Same as SUPABASE_URL.", neededInProd: true },
  { area: "Clients and sign-in", name: "AUTH_SECRET", purpose: "Signs portal and admin sign-in links and sessions.", without: "Nobody can sign in to the portal or admin.", neededInProd: true, example: "openssl rand -hex 32" },
  { area: "Clients and sign-in", name: "ADMIN_EMAIL", purpose: "The owner addresses allowed into /admin, comma-separated. List both the studio address and the inbox it forwards to, so a reply from either counts as yours.", without: "Nobody can sign in to /admin.", neededInProd: true, example: "julian@julianperezphotography.com,you@gmail.com" },
  { area: "Clients and sign-in", name: "BLOB_READ_WRITE_TOKEN", purpose: "Vercel Blob, for questionnaire uploads, portal documents and plan PDFs.", without: "Uploads and stored plan PDFs fail.", neededInProd: true },
  // Content
  { area: "Content", name: "NEXT_PUBLIC_SANITY_PROJECT_ID", purpose: "The Sanity project the content comes from.", without: "The site falls back to the content built into the code; the journal is empty.", neededInProd: true },
  { area: "Content", name: "NEXT_PUBLIC_SANITY_DATASET", purpose: "The Sanity dataset.", without: "Uses production." },
  { area: "Content", name: "SANITY_WEBHOOK_SECRET", purpose: "Verifies Sanity's publish webhook so pages refresh at once.", without: "Edits show up on the next scheduled revalidation instead of immediately." },
  // AI
  { area: "AI", name: "GROQ_API_KEY", purpose: "Every AI feature: drafting, triage, the concierge, alt text.", without: "AI buttons don't appear and the concierge shows a static pointer to the FAQ." },
  { area: "AI", name: "AI_BASE_URL", purpose: "A different OpenAI-compatible provider.", without: "Uses Groq." },
  { area: "AI", name: "AI_MODEL", purpose: "Pins the main model while the provider still serves it.", without: "The site picks one from the live catalogue." },
  { area: "AI", name: "AI_FALLBACK_MODEL", purpose: "Pins the fallback model.", without: "The site picks one from another model family." },
  { area: "AI", name: "AI_VISION_MODEL", purpose: "Pins the model used for image alt text.", without: "The site picks one that passes an image test." },
  // SMS
  { area: "SMS", name: "TWILIO_ACCOUNT_SID", purpose: "Twilio account for confirmation texts (all three TWILIO_* are needed).", without: "No confirmation texts." },
  { area: "SMS", name: "TWILIO_AUTH_TOKEN", purpose: "Twilio auth token.", without: "No confirmation texts." },
  { area: "SMS", name: "TWILIO_PHONE_FROM", purpose: "The sending number, E.164.", without: "No confirmation texts.", example: "+15555550123" },
  { area: "SMS", name: "INQUIRY_SMS_TO", purpose: "Your own number, for a text when a new inquiry looks worth an interruption (a good fit, or high urgency that isn't a mismatch; every inquiry when there's no AI assessment). Needs the TWILIO_* settings.", without: "No owner texts; new inquiries arrive by email only.", example: "+15555550123" },
  // Other services
  { area: "Other services", name: "GOOGLE_PLACES_API_KEY", purpose: "Live Google reviews and address autocomplete.", without: "Reviews fall back to the ones in site settings; address fields are plain text." },
  { area: "Other services", name: "GOOGLE_PLACE_ID", purpose: "The Google Business listing for reviews.", without: "No live reviews." },
  { area: "Other services", name: "CRON_SECRET", purpose: "Authorizes the daily cron (keep-alive, delivery check, AI model check).", without: "In production the cron refuses to run.", neededInProd: true },
  { area: "Other services", name: "NEXT_PUBLIC_SENTRY_DSN", purpose: "Error reporting.", without: "Errors aren't reported anywhere." },
  { area: "Other services", name: "SENTRY_DEV", purpose: "Set to 1 to report errors from a local dev server.", without: "" },
  { area: "Other services", name: "NEXT_PUBLIC_SENTRY_DEV", purpose: "Set to 1 to report browser errors from a local dev server.", without: "" },
  // Stand-ins for tests
  { area: "Tests", name: "RESEND_BASE_URL", purpose: "Points Resend at the e2e fake provider. Never set in production.", without: "" },
  { area: "Tests", name: "TWILIO_BASE_URL", purpose: "Points Twilio at the e2e fake provider. Never set in production.", without: "" },
];

// Settings a production deploy needs but doesn't have.
export function missingInProduction(env: Record<string, string | undefined> = process.env) {
  return SETTINGS.filter((s) => s.neededInProd && !env[s.name]);
}
