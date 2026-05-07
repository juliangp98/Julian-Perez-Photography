<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plan-and-CHANGELOG cycle

Each round of work is captured as a plan file in `~/.claude/plans/` during planning and execution. Once the round is verified and shipped, the closing phase of the plan folds the shipped surface into `CHANGELOG.md` and deletes the plan file. The CHANGELOG entry matches the existing voice in that file: subsystem-level headers, third-person, technical-but-readable, no round numbers, no conversation breadcrumbs, no "as of vN" markers. This keeps `~/.claude/plans/` from accumulating stale documents and `CHANGELOG.md` remains the single durable record of what changed. Treat this close-out as a standing requirement on every plan, not an optional extra.

# Commenting voice

Inline comments and documentation use a neutral, third-person voice. No round numbers, no "added in vN", no agent breadcrumbs, no references to specific planning conversations. The codebase reads as if a single careful author wrote it; new comments should match.
