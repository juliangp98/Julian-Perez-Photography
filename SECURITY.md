# Security

The Next.js app enforces its own protections: security headers, a
Content-Security-Policy in report-only mode, origin checks, a per-instance
rate limit, and signed webhooks. The regular test and review cycle covers
them. This document lists what the code can't do on its own: credentials,
dashboard settings, and DNS. Julian owns these. It also states what the
code does and doesn't promise, so each item can be checked against it.

Walk through it whenever a new integration is added, when credentials are
suspected of being exposed, and as part of a quarterly audit.

## Credentials & rotation

- [ ] Rotate the **Resend API key** after any broad agent-assisted debugging
      session where the key value could have been read into a tool output.
- [ ] Confirm `SANITY_API_WRITE_TOKEN` is **not** in Vercel env — it is only
      needed during `npm run seed:sanity` and must be deleted from both
      `.env.local` and sanity.io after each seed.
- [ ] Rotate `SANITY_WEBHOOK_SECRET` if it has been shared out-of-band or
      not rotated in more than 12 months. Generate via `openssl rand -hex 32`;
      update both the Sanity webhook config and the Vercel env var together.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (client-records CRM) is **server env only**
      (no `NEXT_PUBLIC_`) — it grants full DB access and bypasses Row-Level
      Security. Never expose it client-side. Rotate at Supabase → Settings →
      API if it leaks. The `client_records` table has RLS enabled so nothing
      but the service role can read it.
- [ ] `AUTH_SECRET` (portal and admin magic links and sessions, and the key on
      project form links) is at least 32 hex chars and server env only.
      Rotating it ends every active session, and form links already sent stop
      opening with the client's details (they still work and still attach to
      the project). That is harmless: people request a fresh sign-in link.
      Rotate if exposed.
- [ ] A project's form links carry only the project id and its key, never
      the client's email or phone. The form reads their details on the
      server when the key matches.
- [ ] `RESEND_WEBHOOK_SECRET` verifies Resend's signed events at
      `/api/email/webhook`. Without it the route refuses every event. Rotate
      it in the Resend webhook settings and the Vercel env var together; a
      mismatch drops delivery status and client replies until both match.
- [ ] `RESEND_INBOUND_DOMAIN` names the receiving subdomain for project
      addresses (`reply+<token>@` and `log+<token>@`). Its MX record must
      point at Resend and nowhere else. `npm run email:check` reports it.
- [ ] `CRON_SECRET` is set in production. The daily cron answers 503 in
      production without it, and 401 to any caller without the matching
      `Authorization: Bearer` header.
- [ ] `ADMIN_EMAIL` is set to only the owner address(es). The `/admin`
      dashboard (full record read/edit) is gated to these emails; the allowlist
      is re-checked on every token verify, so removing an address revokes access
      even on an unexpired session.
- [ ] 2FA enabled on every account: Vercel, Sanity, Resend, Twilio, Google
      Cloud, GitHub, Supabase, Sentry, Groq, domain registrar.
- [ ] Passwords stored in a password manager (1Password, Bitwarden, Apple
      Keychain). No reused passwords across vendors.

## Vercel

- [ ] Project Settings → **Environment Variables** — production and preview
      scoped separately. Confirm `RESEND_API_KEY`, `RESEND_FROM` (client mail
      comes from it: julian@, or unset for that default), the three
      `TWILIO_*`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`,
      `SANITY_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, and `AUTH_SECRET` are all present in
      production (server scope; the latter three carry no `NEXT_PUBLIC_` prefix).
      Also confirm `ADMIN_EMAIL`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET` and
      `RESEND_INBOUND_DOMAIN`. `src/lib/config.ts` lists every setting; the
      admin Links page lists any that are missing under Site services.
- [ ] Settings → **Deployment Protection** — enable Vercel Authentication
      on Preview deployments so preview URLs aren't publicly crawlable.
      Previews share env vars with production, which makes them leak-prone
      if they're reachable anonymously.
- [ ] Settings → **Firewall** → the **"Public forms and sign-in rate limit"**
      rule allows 20 requests a minute per IP (fixed window, then 429) across
      the public endpoints that send email, spend AI tokens or build PDFs:
      `/api/inquire`, `/api/questionnaire`, `/api/questionnaire-upload`,
      `/api/portal/request-link`, `/api/admin/request-link`, `/api/concierge`,
      `/api/assist/draft`, `/api/wedding-plan` and `/api/wedding-films-plan`.
      Add a new public route of that kind to the rule's path list. The app's
      own limiter (`src/lib/request-guard.ts`) keeps its counters in memory on
      each serverless instance, so it slows one client on one warm instance
      but not a burst spread across instances; only the firewall rule limits
      across all of them. Address autocomplete is left out on purpose: it
      fires on every keystroke.
- [ ] Settings → **Firewall** → keep **Attack Challenge Mode** ready to turn
      on when traffic looks hostile.
- [ ] Settings → **Logs** — confirm Log Retention meets your needs (1 day
      on the free tier, longer on paid). Consider a Log Drain to Axiom or
      Datadog if persistent debugging history becomes valuable.
- [ ] Settings → **Members** — audit access. Only Julian should hold the
      Owner role.
- [ ] Upload tokens. `/api/questionnaire-upload` issues a token only to a
      browser on this site (the production domain, its www alias, a
      `*.vercel.app` preview, or localhost outside production), only for a
      path under `questionnaires/`, and only for images or PDFs up to 10 MB.
      `/api/portal/upload` issues a token only to a signed-in portal session
      or the owner's admin session, and answers 401 otherwise.
- [ ] **Vercel Blob** lifecycle. Questionnaire uploads land in Blob and
      persist indefinitely by default. Decide on a purge cadence (e.g. 90
      days) and either do it manually via `vercel blob rm` or schedule a
      cleanup function. Blob contents are PII (client names, venue
      floorplans, schedules) and should not accumulate forever.

## Sanity

- [ ] sanity.io/manage → project → **API** → **CORS Origins** — only
      `https://julianperezphotography.com`, `http://localhost:3000`, and
      `http://localhost:3333` (Studio dev). Remove any wildcards.
- [ ] sanity.io/manage → project → **API** → **Tokens** — list every token,
      revoke any that are unused. The seed script's write token should be
      revoked after every successful seed.
- [ ] sanity.io/manage → project → **API** → **Webhooks** — confirm the
      revalidation webhook is pointed at
      `https://julianperezphotography.com/api/sanity-webhook`, filters
      `_type in ["siteSettings","aboutPage","categoryUmbrella","serviceCategory","portfolioCategory","journalPost"]`,
      and its secret matches `SANITY_WEBHOOK_SECRET` in Vercel.
- [ ] sanity.io/manage → project → **Members** — only Julian as Admin.
- [ ] Dataset visibility. `production` is a public dataset. That is the
      correct setting (read-only public queries; no secrets stored in
      Sanity) but confirm it periodically.

## Client portal & CRM

- [ ] Client PII lives only in the private Supabase `client_records` table,
      reached server-side via `src/lib/clients.ts` with the service-role key.
      RLS is enabled on the table; confirm it stays on (Supabase → Auth →
      Policies / table settings) so the anon key can't read it.
- [ ] The portal reads the client projection (`safeSelect()` in
      `src/lib/clients.ts`) — `internal_notes`, the budget, status history,
      and inquiry context are never selected. The questionnaire snapshot is
      held out of the project list and added by the single-project reads: the
      client's own answers in full, and for a second photographer only the
      answers about the shoot (`shootAnswers()`). A second photographer reads
      a narrower projection (`collaboratorSelect()`): no package or payment
      method, and only the links and files whose kind is marked for them in
      `DOCUMENT_TYPES`. Keep internal-only columns out of both when adding
      fields, mark a new link kind `collaborator: false` unless a second
      photographer needs it, and mark a new questionnaire field `booking: true`
      when it is about the tier, an add-on or a bundle. What is withheld is the
      package the client chose and their add-ons; the planning answers still
      describe the coverage, so the tier can sometimes be worked out from them.
- [ ] A client can file an upload only as a timeline, a moodboard or a general
      file. Proposals, contracts, invoices and galleries are added by the owner
      (`/api/admin/update`), and an owner-added link must be an `http(s)`
      address. The Postgres functions that change the `documents` array
      (`add_document`, `remove_document`, `patch_document`) are executable by
      the service role only.
- [ ] Magic links are signed tokens that expire after 20 minutes. They are
      not single-use: the verify routes (`/portal/verify`, `/admin/verify`)
      don't record used tokens, so a link works again until it expires. Anyone
      who gets a forwarded or leaked link inside that window can sign in.
      The request-link endpoints return the same response whether or not the
      address has an account, and carry the per-instance rate limit. A link's
      address comes from the URL the request reached (`originOf` in
      `src/lib/api-route.ts`), never the `Origin` header, so a forged header
      can't point a real sign-in email at another site. Session
      cookies are httpOnly, Secure and SameSite, signed with `AUTH_SECRET`.
- [ ] `client_messages` holds the body of every email and portal message on
      each project's thread, including client replies. RLS is on and no
      policy grants access, so only the service role can read it. Confirm RLS
      stays on, as for `client_records`. The client portal shows only sent,
      delivered, delayed and received messages, and of those only what passed
      between the client and Julian (`src/lib/message-visibility.ts`): mail
      Julian files from others, and held messages, stay admin-only.
- [ ] Each project's reply address carries a secret token
      (`client_records.reply_token`). Anyone who has the address can post to
      that project's thread. What they send is filed and forwarded to the
      owner, flagged when the sender isn't the client or a collaborator.
      Those messages stay out of the client's portal view.
- [ ] The owner's reply reaches a client only when the receiving server
      reports a passing DKIM signature from the sender's own domain. A
      message that claims the owner's address without one is held on the
      thread as unverified, and goes out only when the owner clicks send in
      the admin. Mail sent to a `log+<token>@` address by anyone else is
      filed as unverified and never sent. Mail carrying the site's own marker
      header (`X-JPP-Sent-By`) is filed and never sent on, so a loop through a
      forwarding rule stops there. Review held messages on the thread.
- [ ] Portal reads/writes always resolve the record id from the verified
      session cookie, never from a URL or request body (no IDOR). Confirm any
      new portal route follows this.
- [ ] The `/admin` area (owner-only) uses a separate session cookie + the
      `ADMIN_EMAIL` allowlist. Admin write routes (`/api/admin/*`) verify the
      admin session server-side, independent of the proxy gate.
      `/admin` is in `robots.ts` disallow.
- [ ] **Vercel Blob** lifecycle covers portal document uploads and captured
      plan PDFs too (public, unguessable URLs). Fold these into the same purge
      cadence as questionnaire uploads. They are PII. Removing an entry from a
      project, or deleting the project, leaves the uploaded file in Blob at its
      address (the remove prompt says so); delete the file itself from the
      Vercel Blob dashboard when it must stop being reachable.
- [ ] The Sanity dataset is public, and that includes site settings' how-to-pay
      lines and each service's booking terms. Put a Zelle or Venmo handle there
      only if it can be public.

## Resend

- [ ] **Verify a custom domain** (`julianperezphotography.com` or a
      subdomain like `mail.`) so inquiries don't ship from
      `onboarding@resend.dev`. Resend dashboard → Domains.
- [ ] Publish **SPF**: `v=spf1 include:resend._spf.resend.com ~all` (copy
      the exact string Resend shows in your region).
- [ ] **DKIM** — copy Resend's three CNAME records into DNS.
- [ ] Publish **DMARC**. Start at `v=DMARC1; p=none; rua=mailto:julian@julianperezphotography.com`
      for a one-week soak, then tighten to `p=quarantine`.
- [ ] Resend dashboard → **API Keys**: scoped to this project only, no
      org-wide keys. Revoke any key that leaves a laptop or an agent
      transcript.
- [ ] Resend dashboard → **Webhooks**: one webhook, pointed at
      `https://julianperezphotography.com/api/email/webhook`, sending delivery
      and received events. Its signing secret matches `RESEND_WEBHOOK_SECRET`.
- [ ] Run `npm run email:check` after any DNS or Resend change. It reports
      SPF, DMARC, the sending domain and its DKIM records, the receiving MX,
      and the webhook, with a fix for each failure.

## Sentry

- [ ] All three runtimes share `sentry.shared.ts`. `sendDefaultPii` is
      false. Before an event leaves, the request is cut to its URL and method
      (no body, headers or cookies), and stack-frame local variables are
      removed. Keep any new Sentry config on these shared options.
- [ ] The DSN in `sentry.shared.ts` is public by design. It can submit
      events but not read them. Rotate the project key in Sentry only if
      spam events start arriving.
- [ ] The Content-Security-Policy is sent as
      `Content-Security-Policy-Report-Only` and reports violations to the
      Sentry project's security endpoint. Review those reports. Once they go
      quiet, the next step is to enforce the policy: send it as
      `Content-Security-Policy` in `next.config.ts`.
- [ ] Sentry → **Settings** → **Members**: only Julian. 2FA on.

## Twilio

- [ ] Twilio Console → **Account Settings** → 2FA enabled.
- [ ] Messaging Service → **Geo-Permissions** — restrict to the United
      States unless the business starts serving internationally.
- [ ] **Spend cap** configured at Account Settings → Usage Triggers — alert
      and/or auto-suspend at a low monthly ceiling (e.g. $20).
- [ ] Rotate `TWILIO_AUTH_TOKEN` if it has ever been shared, including via
      agent conversations or pasted into a terminal history.

## Google Places API

- [ ] Google Cloud Console → **APIs & Services** → **Credentials** →
      the Places API key.
- [ ] **API restrictions** — restrict to "Places API (New)" only.
- [ ] **Application restrictions** — HTTP referrers:
      `https://julianperezphotography.com/*`, `http://localhost:3000/*`.
- [ ] **Billing → daily quota cap** — Places is paid per request. 1000/day
      is ample for this site and forms a hard ceiling if the key ever leaks.

## Domain / DNS

- [ ] Registrar 2FA enabled.
- [ ] **Registrar lock** (transfer lock) enabled — prevents unauthorized
      domain transfers.
- [ ] **DNSSEC** enabled at the registrar if supported (Cloudflare,
      Namecheap, Google Domains all do).
- [ ] **CAA records** published allowing only the CAs you use. Vercel uses
      Let's Encrypt: `0 issue "letsencrypt.org"`.
- [ ] After HSTS has been live for 30 days without issues, submit the
      domain to the **HSTS preload list** at https://hstspreload.org.
      Preload bakes HSTS into Chromium, Safari, and Firefox for first-time
      visitors.

## GitHub

- [ ] 2FA enforced on Julian's account.
- [ ] Repo Settings → **Branches** → branch protection on `main`: require
      PR reviews (1), require the **CI / check** status to pass, restrict who
      can push.
- [ ] Repo Settings → **Secrets and variables** → Actions: only
      `TEST_SUPABASE_URL` and `TEST_SUPABASE_SERVICE_ROLE_KEY`, for the
      separate test Supabase project, never production. These keys live
      nowhere else: not in the repo, not in Vercel. CI points every other
      provider at the fake server, so nothing production-critical lives
      here.

## Ongoing hygiene

- [ ] `npm audit` monthly; `npm audit fix` for anything non-breaking.
      Record any major-version bumps as follow-up tasks rather than
      running them inline with other work.
- [ ] Review Vercel deployment logs after each publish for unexpected
      errors.
- [ ] Review Resend Activity weekly — bounces, complaints, unexpected
      volume.
- [ ] Quarterly: audit the Vercel, Sanity, Resend, Twilio, and Google
      Cloud member lists.
