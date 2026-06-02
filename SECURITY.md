# Security

Codebase-level protections (CSP, security headers, XSS fixes, origin checks,
rate limiting, HMAC-verified webhooks) are enforced in the Next.js app itself
and are covered by the regular test and review cycle. This document covers
the remaining surface: credentials, dashboard configuration, and DNS — work
that lives outside the codebase and that Julian owns operationally.

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
- [ ] `AUTH_SECRET` (portal + admin magic links + sessions) is ≥32 hex chars
      and server env only. Rotating it invalidates all active sessions —
      harmless (everyone just requests a fresh sign-in link). Rotate if exposed.
- [ ] `ADMIN_EMAIL` is set to only the owner address(es). The `/admin`
      dashboard (full record read/edit) is gated to these emails; the allowlist
      is re-checked on every token verify, so removing an address revokes access
      even on an unexpired session.
- [ ] 2FA enabled on every account: Vercel, Sanity, Resend, Twilio, Google
      Cloud, GitHub, domain registrar.
- [ ] Passwords stored in a password manager (1Password, Bitwarden, Apple
      Keychain). No reused passwords across vendors.

## Vercel

- [ ] Project Settings → **Environment Variables** — production and preview
      scoped separately. Confirm `RESEND_API_KEY`, `RESEND_FROM`, the three
      `TWILIO_*`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`,
      `SANITY_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, and `AUTH_SECRET` are all present in
      production (server scope; the latter three carry no `NEXT_PUBLIC_` prefix).
- [ ] Settings → **Deployment Protection** — enable Vercel Authentication
      on Preview deployments so preview URLs aren't publicly crawlable.
      Previews share env vars with production, which makes them leak-prone
      if they're reachable anonymously.
- [ ] Settings → **Firewall** — enable **Attack Challenge Mode** so the
      platform auto-rate-limits when traffic patterns look hostile.
- [ ] Settings → **Logs** — confirm Log Retention meets your needs (1 day
      on the free tier, longer on paid). Consider a Log Drain to Axiom or
      Datadog if persistent debugging history becomes valuable.
- [ ] Settings → **Members** — audit access. Only Julian should hold the
      Owner role.
- [ ] **Vercel Blob** lifecycle — questionnaire uploads land in Blob and
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
- [ ] Dataset visibility — `production` is a public dataset. That is the
      correct setting (read-only public queries; no secrets stored in
      Sanity) but confirm it periodically.
## Client portal & CRM

- [ ] Client PII lives only in the private Supabase `client_records` table,
      reached server-side via `src/lib/clients.ts` with the service-role key.
      RLS is enabled on the table; confirm it stays on (Supabase → Auth →
      Policies / table settings) so the anon key can't read it.
- [ ] The portal selects `SAFE_SELECT` only — `internal_notes`, the
      questionnaire snapshot, status history, and inquiry context are never
      selected. Keep internal-only columns out of that projection when adding
      fields.
- [ ] Magic-link tokens are short-lived (20 min) and the login endpoint is
      rate-limited + returns a uniform response (no account enumeration).
      Session cookies are httpOnly/Secure/SameSite, signed with `AUTH_SECRET`.
- [ ] Portal reads/writes always resolve the record id from the verified
      session cookie, never from a URL or request body (no IDOR). Confirm any
      new portal route follows this.
- [ ] The `/admin` area (owner-only) uses a separate session cookie + the
      `ADMIN_EMAIL` allowlist. Admin write routes (`/api/admin/*`) verify the
      admin session server-side, independent of the proxy gate.
      `/admin` is in `robots.ts` disallow.
- [ ] **Vercel Blob** lifecycle covers portal document uploads + captured plan
      PDFs too (public, unguessable URLs). Fold these into the same purge
      cadence as questionnaire uploads — they're PII.

## Resend

- [ ] **Verify a custom domain** (`julianperezphotography.com` or a
      subdomain like `mail.`) so inquiries don't ship from
      `onboarding@resend.dev`. Resend dashboard → Domains.
- [ ] Publish **SPF**: `v=spf1 include:resend._spf.resend.com ~all` (copy
      the exact string Resend shows in your region).
- [ ] **DKIM** — copy Resend's three CNAME records into DNS.
- [ ] Publish **DMARC**. Start at `v=DMARC1; p=none; rua=mailto:juliangperez@gmail.com`
      for a one-week soak, then tighten to `p=quarantine`.
- [ ] Resend dashboard → **API Keys** — scoped to this project only; no
      org-wide keys. Revoke any key that leaves a laptop or an agent
      transcript.

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
      PR reviews (1), require status checks to pass, restrict who can push.
- [ ] Repo Settings → **Secrets and variables** — audit any GitHub Actions
      secrets. Nothing production-critical should live here unless CI
      actually needs it.

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
