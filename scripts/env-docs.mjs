// Writes .env.example and docs/configuration.md from the settings list in
// src/lib/config.ts, so the two can't drift from what the code reads.
//
//   npm run env:docs            write both files
//   npm run env:docs -- --check exit 1 when either is out of date (the spec)

import { readFileSync, writeFileSync } from "node:fs";
import { SETTINGS } from "../src/lib/config.ts";

const areas = [...new Set(SETTINGS.map((s) => s.area))];

function renderEnvExample(settings = SETTINGS) {
  const lines = [
    "# Copy to .env.local and fill in what you use. Generated from src/lib/config.ts",
    "# by `npm run env:docs`; docs/configuration.md explains each one.",
  ];
  for (const area of [...new Set(settings.map((s) => s.area))]) {
    lines.push("", `# ${area}`);
    for (const s of settings.filter((x) => x.area === area)) {
      lines.push(`# ${s.purpose}`, `${s.name}=`);
    }
  }
  return lines.join("\n") + "\n";
}

function renderConfigDoc(settings = SETTINGS) {
  const out = [
    "# Configuration",
    "",
    "Every setting the site reads. Generated from `src/lib/config.ts` by `npm run env:docs`; edit that file, not this one. Set them in `.env.local` for local work (start from `.env.example`) and in Vercel → Settings → Environment Variables for deploys. None of them may carry a `NEXT_PUBLIC_` prefix unless it already has one.",
    "",
    "The site checks itself: missing settings that production needs are logged once when the server starts and listed under Site services on the admin Links page.",
  ];
  for (const area of areas.filter((a) => settings.some((s) => s.area === a))) {
    out.push("", `## ${area}`, "", "| Setting | Production | What it's for | Without it |", "|---|---|---|---|");
    for (const s of settings.filter((x) => x.area === area)) {
      const example = s.example ? ` Example: \`${s.example}\`.` : "";
      out.push(`| \`${s.name}\` | ${s.neededInProd ? "needed" : "optional"} | ${s.purpose}${example} | ${s.without || "Nothing breaks."} |`);
    }
  }
  out.push(
    "",
    "## Email relay setup",
    "",
    "Client replies come back to the site through Resend's receiving domains, so they land on the project's thread as well as your inbox.",
    "",
    "1. In Resend → Domains, add a receiving domain on a subdomain, e.g. `in.julianperezphotography.com`. Its MX records go on that subdomain only, so Gmail on the root domain is untouched.",
    "2. In Resend → Webhooks, add `https://julianperezphotography.com/api/email/webhook` for the `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed` and `email.received` events. Copy its signing secret.",
    "3. Set `RESEND_INBOUND_DOMAIN` and `RESEND_WEBHOOK_SECRET` in Vercel and redeploy.",
    "4. Run `npm run email:check`: it confirms SPF, DKIM and DMARC, the domain's status, the receiving MX records and the webhook.",
    "5. Client mail comes from `Julian Perez <julian@julianperezphotography.com>` and the site's alerts to you from noreply@ on the same domain. If `RESEND_FROM` is set in Vercel to another address, change it or delete it so this default applies.",
    "",
    "Until step 3, sends are still recorded on each thread, and replies reach julian@ (your inbox) rather than the thread.",
  );
  return out.join("\n") + "\n";
}

const targets = [
  [new URL("../.env.example", import.meta.url), renderEnvExample()],
  [new URL("../docs/configuration.md", import.meta.url), renderConfigDoc()],
];
if (process.argv.includes("--check")) {
  const stale = targets.filter(([url, text]) => {
    try {
      return readFileSync(url, "utf8") !== text;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Out of date: ${stale.map(([u]) => u.pathname.split("/").pop()).join(", ")}. Run npm run env:docs.`);
    process.exit(1);
  }
} else {
  for (const [url, text] of targets) writeFileSync(url, text);
  console.log("Wrote .env.example and docs/configuration.md");
}
