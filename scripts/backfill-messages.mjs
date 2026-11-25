// Files emails the site sent before message threads existed onto each
// project's thread, from Resend's log. Resend keeps a limited history, so this
// reaches back only as far as your plan's retention; the run prints the oldest
// email it could see. Mail that only lives in Gmail (a client's reply, say) is
// filed by forwarding it to the project's filing address instead.
//
//   npm run messages:backfill            — dry run: lists what would be filed
//   npm run messages:backfill -- --apply — files them (safe to re-run)
//
// Needs RESEND_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const { RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set RESEND_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STATUS = {
  delivered: "delivered",
  opened: "delivered",
  clicked: "delivered",
  bounced: "bounced",
  complained: "complained",
  failed: "failed",
  suppressed: "failed",
  delivery_delayed: "delayed",
};

async function allSentEmails() {
  const out = [];
  let after;
  for (;;) {
    const { data, error } = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) });
    if (error) throw new Error(`Resend: ${error.message}`);
    out.push(...data.data);
    if (!data.has_more || !data.data.length) return out;
    after = data.data.at(-1).id;
  }
}

// email → the most recently updated project for that person.
async function projectsByEmail() {
  const { data, error } = await db
    .from("client_records")
    .select("id, email, updated_at")
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return new Map(data.map((r) => [r.email.trim().toLowerCase(), r.id]));
}

const [emails, projects] = await Promise.all([allSentEmails(), projectsByEmail()]);
const { data: existing } = await db.from("client_messages").select("resend_id").not("resend_id", "is", null);
const known = new Set((existing ?? []).map((r) => r.resend_id));

const toFile = [];
for (const e of emails) {
  if (known.has(e.id)) continue;
  const recipient = e.to.map((t) => t.toLowerCase()).find((t) => projects.has(t));
  if (recipient) toFile.push({ email: e, projectId: projects.get(recipient), recipient });
}

const oldest = emails.at(-1)?.created_at;
console.log(`Resend returned ${emails.length} emails${oldest ? `, the oldest from ${oldest}` : ""}.`);
console.log(`${toFile.length} went to a client and aren't on a thread yet:`);
for (const { email, recipient } of toFile) {
  console.log(`  ${email.created_at.slice(0, 10)}  ${recipient.padEnd(32)}  ${email.subject}`);
}
if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to file them.");
  process.exit(0);
}

let filed = 0;
for (const { email, projectId, recipient } of toFile) {
  const { data: full } = await resend.emails.get(email.id);
  const { error } = await db.from("client_messages").insert({
    project_id: projectId,
    direction: "out",
    channel: "email",
    kind: "imported",
    from_addr: email.from,
    to_addr: recipient,
    subject: email.subject,
    body_text: full?.text ?? null,
    resend_id: email.id,
    status: STATUS[email.last_event] ?? "sent",
    sent_at: email.created_at,
  });
  if (error && error.code !== "23505") throw error;
  if (!error) filed++;
}
console.log(`\nFiled ${filed} emails.`);
