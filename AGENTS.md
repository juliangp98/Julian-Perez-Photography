<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plan-and-CHANGELOG cycle

Each round of work is captured as a plan file in `~/.claude/plans/` during planning and execution. Once the round is verified and shipped, the closing phase of the plan folds the shipped surface into `CHANGELOG.md` and deletes the plan file. The CHANGELOG entry matches the existing voice in that file: subsystem-level headers, third-person, technical-but-readable, no round numbers, no conversation breadcrumbs, no "as of vN" markers. This keeps `~/.claude/plans/` from accumulating stale documents and `CHANGELOG.md` remains the single durable record of what changed. Treat this close-out as a standing requirement on every plan, not an optional extra.

# Commenting voice

Inline comments and documentation use a neutral, third-person voice. No round numbers, no "added in vN", no agent breadcrumbs, no references to specific planning conversations. The codebase reads as if a single careful author wrote it; new comments should match.

# Test + observability discipline

Every round of work that ships new code paths (new routes, new components, new data flows, new API surfaces) updates two surfaces alongside the code itself:

1. **End-to-end tests** in `tests/e2e/` — at minimum a smoke-level Playwright spec exercising the new surface from the user's perspective. Existing patterns to mirror: form submissions via `request.post` (see `tests/e2e/subject-line.spec.ts`), page renders via `page.goto` + role/text assertions (see `tests/e2e/wedding-films.spec.ts`), accessibility scans via `@axe-core/playwright` (see `tests/e2e/a11y.spec.ts`). New API routes get an API-level rejection / success / honeypot triplet matching `tests/e2e/wedding-pdf.spec.ts`.
2. **Sentry instrumentation** — server-side `Sentry.captureException(err, { tags: { route, stage } })` calls inside every catch block on the new code paths, with `level: "warning"` for fire-and-forget side effects (SMS, client confirmations) and the default fatal level for primary failure modes. Client-side coverage is automatic via the `@sentry/nextjs` App Router integration, but new error boundaries should still call `Sentry.captureException` explicitly the way `src/app/error.tsx` and `src/app/global-error.tsx` do.

A round is not done until both are updated. The plan-and-CHANGELOG cycle's close-out checklist lives by this rule.
