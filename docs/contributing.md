# Contributing

The house rules for this site, and what enforces each one. `AGENTS.md` covers the process (plans, the CHANGELOG, tests and Sentry on every new surface).

## One definition per thing

Shared logic lives in `src/lib`, shared UI in `src/components/ui`. Before writing a helper, a label map, a formatter or a component, look for the one that exists. Labels come from `src/lib/labels.ts` and `src/lib/client-status.ts`, dates and phone numbers from `src/lib/field-format.ts`, service names and nouns from `src/lib/services-data.ts`.

## The UI kit first

- Buttons and button-styled links: `Button` (variants `primary`, `secondary`, `ghost`, `danger`, `text`; `loading` for in-flight states).
- The line after an action: `FormStatus`. Every action confirms itself there rather than counting on the refreshed page to show it worked. Copying: `CopyButton` or `CopyField`. Status chips: `Badge`.
- Boxes: `Panel` (with `tone`), `CalloutCard`, `RailCard`.
- Form controls: the `fields/` components; every dropdown is `Select` or `SelectField`.
- Colors come from the theme tokens (`text-muted`, `border-border`, `text-accent`, `text-danger`, ...), never hex values or `[var(--...)]` classes.

`tests/e2e/style-system.spec.ts` fails on a raw `<select>`, hard-coded colors, `[var(--...)]` color classes, retired pieces, and any route `loading.tsx` (on this Next version a loading boundary makes `router.refresh()` drop updates after an action).

## One feature, one job

Each feature does one thing, and nothing else does that thing. Client email is drafted only by the compose panel's "Draft with AI" (`/api/admin/draft-email`); the assessment and the project's next step hand off to it rather than writing their own. Website copy (a journal post, or a service or portfolio page's copy) is drafted only on the Content page's Website copy tab (`/api/admin/draft-copy`). Every email goes through `sendEmail()` in `src/lib/email/send.ts`. JSON API routes are declared with `defineRoute()` in `src/lib/api-route.ts`.

## Writing

Visible text is plain and specific: short sentences, one idea each, in Julian's first person where he's speaking. No em dashes (use a comma, a colon or a full stop), none of the phrases in `src/lib/copy-rules.json`, and at most one exclamation mark in an email. FAQ answers start with the fact. `npm run lint` runs `scripts/check-copy.mjs`, which enforces this on string literals and JSX text (comments and AI prompts are skipped). Keep facts exact when rewriting: prices, durations, names, `{{tokens}}` and `[placeholders]`.

## Settings

Every setting the code reads is listed in `src/lib/config.ts` with what goes without it. Add a new one there, then run `npm run env:docs` to regenerate `.env.example` and `docs/configuration.md`. `tests/e2e/config.spec.ts` fails when a setting is missing from the list or the generated files are stale. The admin Links page names settings from this list for its badges and its Setup list, and `tests/e2e/links-page.spec.ts` fails on a name the list doesn't have.

## Email on the domain

Addresses on the site's domains are Cloudflare Email Routing rules forwarding to the owner's inbox, not paid mailboxes. Resend sends from its own subdomain records and receives client replies on the `in.` subdomain, so the root MX stays with Email Routing. Web records stay DNS only (grey cloud) when the site is on Vercel.

## Tests and errors

Every new route, page or data flow gets a Playwright spec in `tests/e2e/`, built on `tests/e2e/support/fixtures.ts` (signed-in requests, the `fakes` fixture for provider calls). Specs never reach a real provider. Catch blocks on server paths call `Sentry.captureException(err, { tags: { route, stage } })`, at `level: "warning"` for side effects that don't fail the request.

## Commits

Subject: "Area: what changed, in plain words", under about 72 characters, saying the outcome ("Messages: client replies land on the project's thread"). Not "Enhance X", "improve Y" or "for improved Z". Body: two to five lines on why.
