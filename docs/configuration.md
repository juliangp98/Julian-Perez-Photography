# Configuration

Every setting the site reads. Generated from `src/lib/config.ts` by `npm run env:docs`; edit that file, not this one. Set them in `.env.local` for local work (start from `.env.example`) and in Vercel → Settings → Environment Variables for deploys. None of them may carry a `NEXT_PUBLIC_` prefix unless it already has one.

The site checks itself: missing settings that production needs are logged once when the server starts and listed under Site services on the admin Links page.

## Email

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `RESEND_API_KEY` | needed | Sends every email (inquiries, confirmations, sign-in links, client messages). Example: `re_...`. | No email goes out; in production, forms report an error instead of pretending to send. |
| `RESEND_FROM` | optional | The sender of mail to clients, on the domain verified in Resend. The site's alerts to you come from noreply@ on the same domain. Example: `Julian Perez <julian@julianperezphotography.com>`. | Client mail comes from Julian Perez <julian@julianperezphotography.com>. |
| `INQUIRY_TO` | optional | Where owner alerts go (new inquiries, forwarded client replies, the morning email). | Owner alerts go to the contact email in Sanity site settings. |
| `RESEND_INBOUND_DOMAIN` | optional | The receiving subdomain for client replies (reply+<token>@ and log+<token>@). Example: `in.julianperezphotography.com`. | Replies go straight to your inbox and don't appear on the project thread. |
| `RESEND_WEBHOOK_SECRET` | optional | Verifies Resend's delivery and inbound events at /api/email/webhook. Example: `whsec_...`. | No delivery status or replies on project threads (the webhook refuses everything). |
| `DEV_EMAIL_TO` | optional | Where preview and local builds send email instead of the real recipient. | Those builds send to the first ADMIN_EMAIL. |
| `NOTIFY_CLIENT_EDITS` | optional | Set to false to stop the emails when a client edits their portal details, starts a project or uploads a file. | Nothing breaks. |

## Clients and sign-in

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `SUPABASE_URL` | needed | The private client store (projects, messages, settings). Example: `https://<ref>.supabase.co`. | No client records, portal, admin projects or message threads. |
| `SUPABASE_SERVICE_ROLE_KEY` | needed | Server-only key for the client store. | Same as SUPABASE_URL. |
| `AUTH_SECRET` | needed | Signs portal and admin sign-in links and sessions, and the key on a project's form links that opens them with the client's details filled in. Example: `openssl rand -hex 32`. | Nobody can sign in to the portal or admin, and form links open empty. |
| `ADMIN_EMAIL` | needed | The owner addresses allowed into /admin, comma-separated. List both the studio address and the inbox it forwards to, so a reply from either counts as yours. Example: `julian@julianperezphotography.com,you@gmail.com`. | Nobody can sign in to /admin. |
| `BLOB_READ_WRITE_TOKEN` | needed | Vercel Blob, for questionnaire uploads, portal documents and plan PDFs. | Uploads and stored plan PDFs fail. |

## Content

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | needed | The Sanity project the content comes from. | The site falls back to the content built into the code; the journal is empty. |
| `NEXT_PUBLIC_SANITY_DATASET` | optional | The Sanity dataset. | Uses production. |
| `SANITY_WEBHOOK_SECRET` | optional | Verifies Sanity's publish webhook so pages refresh at once. | Edits show up on the next scheduled revalidation instead of immediately. |

## AI

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `GROQ_API_KEY` | optional | Every AI feature: drafting, triage, the concierge, alt text. | AI buttons don't appear and the concierge shows a static pointer to the FAQ. |
| `AI_BASE_URL` | optional | A different OpenAI-compatible provider. | Uses Groq. |
| `AI_MODEL` | optional | Pins the main model while the provider still serves it. | The site picks one from the live catalogue. |
| `AI_FALLBACK_MODEL` | optional | Pins the fallback model. | The site picks one from another model family. |
| `AI_VISION_MODEL` | optional | Pins the model used for image alt text. | The site picks one that passes an image test. |

## SMS

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | optional | Twilio account for confirmation texts (all three TWILIO_* are needed). | No confirmation texts. |
| `TWILIO_AUTH_TOKEN` | optional | Twilio auth token. | No confirmation texts. |
| `TWILIO_PHONE_FROM` | optional | The sending number, E.164. Example: `+15555550123`. | No confirmation texts. |
| `INQUIRY_SMS_TO` | optional | Your own number, for a text when a new inquiry looks worth an interruption (a good fit, or high urgency that isn't a mismatch; every inquiry when there's no AI assessment). Needs the TWILIO_* settings. Example: `+15555550123`. | No owner texts; new inquiries arrive by email only. |

## Other services

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `GOOGLE_PLACES_API_KEY` | optional | Live Google reviews and address autocomplete. | Reviews fall back to the ones in site settings; address fields are plain text. |
| `GOOGLE_PLACE_ID` | optional | The Google Business listing for reviews. | No live reviews. |
| `CRON_SECRET` | needed | Authorizes the daily cron (keep-alive, delivery check, morning email, AI model check). | In production the cron refuses to run. |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Error reporting. | Errors aren't reported anywhere. |
| `SENTRY_DEV` | optional | Set to 1 to report errors from a local dev server. | Nothing breaks. |
| `NEXT_PUBLIC_SENTRY_DEV` | optional | Set to 1 to report browser errors from a local dev server. | Nothing breaks. |

## Tests

| Setting | Production | What it's for | Without it |
|---|---|---|---|
| `RESEND_BASE_URL` | optional | Points Resend at the e2e fake provider. Never set in production. | Nothing breaks. |
| `TWILIO_BASE_URL` | optional | Points Twilio at the e2e fake provider. Never set in production. | Nothing breaks. |

## Email relay setup

Client replies come back to the site through Resend's receiving domains, so they land on the project's thread as well as your inbox.

1. In Resend → Domains, add a receiving domain on a subdomain, e.g. `in.julianperezphotography.com`. Its MX records go on that subdomain only, so Gmail on the root domain is untouched.
2. In Resend → Webhooks, add `https://julianperezphotography.com/api/email/webhook` for the `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed` and `email.received` events. Copy its signing secret.
3. Set `RESEND_INBOUND_DOMAIN` and `RESEND_WEBHOOK_SECRET` in Vercel and redeploy.
4. Run `npm run email:check`: it confirms SPF, DKIM and DMARC, the domain's status, the receiving MX records and the webhook.
5. Client mail comes from `Julian Perez <julian@julianperezphotography.com>` and the site's alerts to you from noreply@ on the same domain. If `RESEND_FROM` is set in Vercel to another address, change it or delete it so this default applies.

Until step 3, sends are still recorded on each thread, and replies reach julian@ (your inbox) rather than the thread.
