// Is email set up to deliver and come back? Checks the sending domain's DNS
// (SPF, DMARC), its status and DKIM records in Resend, the receiving domain's
// MX records, and the webhook that feeds project threads. Each failure prints
// the fix. Read-only unless --send is given.
//
//   npm run email:check
//   npm run email:check -- --send you@example.com   also send a test email and
//                                                    report what Resend did with it

import { resolveMx, resolveTxt } from "node:dns/promises";
import { Resend } from "resend";

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("RESEND_API_KEY isn't set (put it in .env.local).");
  process.exit(1);
}
const resend = new Resend(key);
const from = process.env.RESEND_FROM || "Julian Perez Photography <noreply@julianperezphotography.com>";
const sendingDomain = (from.match(/@([^>\s]+)/)?.[1] ?? "").toLowerCase();
const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.toLowerCase();
let failures = 0;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg, fix) => {
  failures++;
  console.log(`  ✗ ${msg}\n    → ${fix}`);
};
const txt = (name) => resolveTxt(name).then((r) => r.map((parts) => parts.join("")), () => []);

console.log(`Sending domain: ${sendingDomain}`);
const spf = (await txt(sendingDomain)).find((r) => r.startsWith("v=spf1"));
spf ? ok(`SPF: ${spf}`) : bad("No SPF record", "Add the SPF TXT record Resend shows under Domains → your domain.");
const dmarc = (await txt(`_dmarc.${sendingDomain}`)).find((r) => r.startsWith("v=DMARC1"));
dmarc
  ? ok(`DMARC: ${dmarc}`)
  : bad("No DMARC record", `Add a TXT record at _dmarc.${sendingDomain}, e.g. "v=DMARC1; p=none; rua=mailto:you@example.com".`);

const { data: domains, error: listError } = await resend.domains.list();
if (listError) {
  bad(`Resend refused the key: ${listError.message}`, "Check RESEND_API_KEY; it needs full access to read domains.");
} else {
  const sending = domains.data.find((d) => d.name === sendingDomain);
  if (!sending) {
    bad(`${sendingDomain} isn't in Resend`, "Add it in Resend → Domains and publish the records it lists.");
  } else {
    const { data: detail } = await resend.domains.get(sending.id);
    sending.status === "verified"
      ? ok(`Resend: ${sendingDomain} is verified`)
      : bad(`Resend: ${sendingDomain} is ${sending.status}`, "Publish the DNS records Resend lists, then press Verify.");
    for (const r of detail?.records ?? []) {
      if (r.status !== "verified") bad(`${r.record} record ${r.name} is ${r.status}`, `Publish: ${r.type} ${r.name} → ${r.value}`);
    }
  }

  if (!inboundDomain) {
    bad("RESEND_INBOUND_DOMAIN isn't set", "Replies won't reach project threads. See docs/configuration.md → Email relay setup.");
  } else {
    const mx = await resolveMx(inboundDomain).catch(() => []);
    mx.some((m) => /resend|amazonses|inbound/i.test(m.exchange))
      ? ok(`Receiving: ${inboundDomain} MX → ${mx.map((m) => m.exchange).join(", ")}`)
      : bad(`Receiving: ${inboundDomain} has no Resend MX record`, "Add the receiving domain in Resend and publish its MX records on that subdomain.");
  }
}

const { data: hooks } = await resend.webhooks.list();
const hook = hooks?.data.find((h) => h.endpoint.endsWith("/api/email/webhook"));
if (!hook) {
  bad("No webhook to /api/email/webhook", "Add it in Resend → Webhooks (events: email.* including email.received).");
} else {
  const missing = ["email.delivered", "email.bounced", "email.complained", "email.received"].filter(
    (e) => hook.events && !hook.events.includes(e),
  );
  hook.status !== "enabled"
    ? bad(`Webhook ${hook.endpoint} is ${hook.status}`, "Enable it in Resend → Webhooks.")
    : missing.length
      ? bad(`Webhook is missing ${missing.join(", ")}`, "Edit the webhook's events in Resend.")
      : ok(`Webhook: ${hook.endpoint}`);
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    bad("RESEND_WEBHOOK_SECRET isn't set here", "Copy the webhook's signing secret into .env.local and Vercel.");
  }
}

const to = process.argv[process.argv.indexOf("--send") + 1];
if (process.argv.includes("--send") && to) {
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "Test from npm run email:check",
    text: "If you can read this, the site can send email.",
  });
  if (error) {
    bad(`Test send refused: ${error.message}`, "Fix the problems above first; a refused send names the reason.");
  } else {
    console.log(`  Sent test email ${data.id}; checking what happened…`);
    let last = "queued";
    for (let i = 0; i < 6 && ["queued", "sent"].includes(last); i++) {
      await new Promise((r) => setTimeout(r, 5000));
      last = (await resend.emails.get(data.id)).data?.last_event ?? last;
    }
    last === "delivered" ? ok(`Test email delivered to ${to}`) : bad(`Test email is "${last}"`, "Open it in Resend → Emails for the details.");
  }
}

console.log(failures ? `\n${failures} problem(s).` : "\nEmail is set up.");
process.exit(failures ? 1 : 0);
