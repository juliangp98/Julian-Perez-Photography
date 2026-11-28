// The per-project message thread (client_messages): every email the site sends
// a client, its delivery status, replies that come back through the project's
// reply address, and messages posted in the portal. Server-only, service-role.

import "server-only";
import { randomBytes } from "node:crypto";
import { db, isClientsStoreConfigured, isRecordId } from "@/lib/clients";
import type { SentEmail } from "@/lib/next-step";
import { CLIENT_VISIBLE, fromClient, visibleToClient } from "@/lib/message-visibility";
import { missingColumn } from "@/lib/missing-column";

const TABLE = "client_messages";

export type MessageDirection = "in" | "out";
export type MessageKind =
  | "compose"
  | "update"
  | "confirmation"
  | "relay"
  | "reply"
  | "portal"
  | "imported"
  // A repeat inquiry from the site's form, on a project that already existed.
  | "inquiry";
export type MessageStatus =
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "failed"
  | "received"
  | "unverified"
  | "dropped";

export type MessageAttachment = { id?: string; filename: string; contentType?: string; size?: number };

export type ClientMessage = {
  id: string;
  projectId: string;
  direction: MessageDirection;
  channel: "email" | "portal";
  kind: MessageKind;
  fromAddr?: string;
  toAddr?: string;
  subject?: string;
  bodyText?: string;
  resendId?: string;
  messageId?: string;
  inReplyTo?: string;
  status: MessageStatus;
  statusDetail?: string;
  attachments: MessageAttachment[];
  sentAt: string;
  // The pipeline template it was sent from, when there was one.
  template?: string;
  // Whether Julian's email started as an AI draft.
  aiDrafted?: boolean;
};

const SELECT_BASE =
  "id, projectId:project_id, direction, channel, kind, fromAddr:from_addr, toAddr:to_addr, subject, bodyText:body_text, resendId:resend_id, messageId:message_id, inReplyTo:in_reply_to, status, statusDetail:status_detail, attachments, sentAt:sent_at";

// Columns that came after the table: the template an email was sent from,
// and whether it started as an AI draft. If a deploy lands before one is
// added, the first read or write that names it fails (missingColumn); that's
// noted once, and the rest of the process reads and writes without that
// column, as the project reads do for their later columns
// (src/lib/clients.ts). Each column is noted on its own, so one missing never
// takes the other with it.
const laterColumns = {
  template: { present: true, match: /\btemplate\b/ },
  aiDrafted: { present: true, match: /\bai_drafted\b/ },
};
const has = (column: keyof typeof laterColumns) => laterColumns[column].present;
const select = () =>
  SELECT_BASE + (has("template") ? ", template" : "") + (has("aiDrafted") ? ", aiDrafted:ai_drafted" : "");
// Notes any later column the error names as missing, and says whether to try
// again without it. A request built before another noticed retries too.
function laterColumnMissing(error: { code?: string; message?: string } | null): boolean {
  let retry = false;
  for (const column of Object.values(laterColumns)) {
    if (missingColumn(error, column.match)) {
      column.present = false;
      retry = true;
    }
  }
  return retry;
}

// Whether a message is part of the conversation with the client: the
// client's own writing that was received (a reply from their address, a portal
// post, a repeat inquiry; see fromClient), or something Julian wrote that went
// out, by email or in the portal. Leaves out mail from anyone else on the
// thread, bounces, out-of-office replies held back, relays never sent, and the
// site's automatic emails. Matches the client_last_contact view.
const WRITTEN_KINDS: MessageKind[] = ["compose", "relay", "imported", "portal"];
const WENT_OUT: MessageStatus[] = ["sent", "delivered", "delayed"];
function wentOutWritten(m: Pick<ClientMessage, "direction" | "kind" | "status">): boolean {
  return m.direction === "out" && WRITTEN_KINDS.includes(m.kind) && WENT_OUT.includes(m.status);
}
export function isConversation(
  m: Pick<ClientMessage, "direction" | "channel" | "kind" | "status" | "fromAddr">,
  clientEmail?: string,
): boolean {
  return m.direction === "in" ? m.status === "received" && fromClient(m, clientEmail) : wentOutWritten(m);
}

// An email as the next-step rules count it (sentTemplates): one that went
// out, or one the client marked as spam, which arrived.
export function sentEmail(
  m: Pick<ClientMessage, "direction" | "kind" | "status" | "template" | "subject" | "sentAt">,
): SentEmail {
  return {
    direction: m.direction,
    template: m.template,
    subject: m.subject,
    sentAt: m.sentAt,
    wentOut: wentOutWritten(m) || (m.direction === "out" && m.status === "complained"),
  };
}

// The outgoing emails of these projects, by project id, as the rules count
// them. Only what the rules read is selected.
export async function listSentEmails(projectIds: string[]): Promise<Map<string, SentEmail[]>> {
  const byProject = new Map<string, SentEmail[]>();
  const wanted = projectIds.filter(isRecordId);
  if (!isClientsStoreConfigured() || !wanted.length) return byProject;
  const base = "projectId:project_id, direction, kind, status, subject, sentAt:sent_at";
  const read = () =>
    db()
      .from(TABLE)
      .select(has("template") ? `${base}, template` : base)
      .in("project_id", wanted)
      .eq("direction", "out")
      .order("sent_at", { ascending: true });
  let { data, error } = await read();
  if (laterColumnMissing(error)) ({ data, error } = await read());
  if (error) throw error;
  type Row = Pick<ClientMessage, "projectId" | "direction" | "kind" | "status" | "subject" | "sentAt" | "template">;
  for (const m of (data as unknown as Row[] | null) ?? []) {
    const list = byProject.get(m.projectId) ?? [];
    list.push(sentEmail(m));
    byProject.set(m.projectId, list);
  }
  return byProject;
}

export type NewMessage = {
  projectId: string;
  direction: MessageDirection;
  channel?: "email" | "portal";
  kind: MessageKind;
  fromAddr?: string;
  toAddr?: string;
  subject?: string;
  bodyText?: string;
  resendId?: string;
  messageId?: string;
  inReplyTo?: string;
  idempotencyKey?: string;
  status: MessageStatus;
  statusDetail?: string;
  attachments?: MessageAttachment[];
  sentAt?: string;
  template?: string;
  aiDrafted?: boolean;
};

// Records a message and returns whether it was new. A repeat of the same Resend
// id or idempotency key (a webhook retry, a double-submitted send) is ignored
// rather than duplicated, and returns false.
export async function recordMessage(m: NewMessage): Promise<boolean> {
  if (!isClientsStoreConfigured()) return false;
  let { error } = await insertMessage(m);
  if (laterColumnMissing(error)) ({ error } = await insertMessage(m));
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

function insertMessage(m: NewMessage) {
  return db().from(TABLE).insert({
    project_id: m.projectId,
    direction: m.direction,
    channel: m.channel ?? "email",
    kind: m.kind,
    from_addr: m.fromAddr,
    to_addr: m.toAddr,
    subject: m.subject,
    body_text: m.bodyText,
    resend_id: m.resendId,
    message_id: m.messageId,
    in_reply_to: m.inReplyTo,
    idempotency_key: m.idempotencyKey,
    status: m.status,
    status_detail: m.statusDetail,
    attachments: m.attachments ?? [],
    ...(m.sentAt ? { sent_at: m.sentAt } : {}),
    ...(m.template && has("template") ? { template: m.template } : {}),
    ...(m.aiDrafted && has("aiDrafted") ? { ai_drafted: true } : {}),
  });
}

// A project's thread, oldest first. The client's view (`clientView`, with
// the address on the project) holds only what passed between them and Julian
// (src/lib/message-visibility.ts).
export async function listProjectMessages(
  projectId: string,
  opts: { clientView?: { email?: string } } = {},
): Promise<ClientMessage[]> {
  if (!isClientsStoreConfigured() || !isRecordId(projectId)) return [];
  const read = () => {
    let q = db().from(TABLE).select(select()).eq("project_id", projectId);
    if (opts.clientView) q = q.in("status", CLIENT_VISIBLE);
    return q.order("sent_at", { ascending: true });
  };
  let { data, error } = await read();
  if (laterColumnMissing(error)) ({ data, error } = await read());
  if (error) throw error;
  const messages = (data as unknown as ClientMessage[] | null) ?? [];
  const view = opts.clientView;
  return view ? messages.filter((m) => visibleToClient(m, view.email)) : messages;
}

export async function getMessage(id: string): Promise<ClientMessage | null> {
  if (!isClientsStoreConfigured()) return null;
  const read = () => db().from(TABLE).select(select()).eq("id", id).maybeSingle();
  let { data, error } = await read();
  if (laterColumnMissing(error)) ({ data, error } = await read());
  if (error) throw error;
  return (data as unknown as ClientMessage | null) ?? null;
}

// Delivery events arrive out of order (a `delivered` can follow a
// `delivery_delayed`); a final state is never walked back to an earlier one.
const FINAL: MessageStatus[] = ["delivered", "bounced", "complained", "failed"];

// Returns the message's project id when a thread message was updated.
export async function updateMessageStatus(
  resendId: string,
  status: MessageStatus,
  detail?: string,
): Promise<{ projectId: string; toAddr?: string } | null> {
  if (!isClientsStoreConfigured()) return null;
  let q = db()
    .from(TABLE)
    .update({ status, status_detail: detail ?? null })
    .eq("resend_id", resendId);
  if (!FINAL.includes(status)) q = q.not("status", "in", `(${FINAL.join(",")})`);
  const { data, error } = await q.select("projectId:project_id, toAddr:to_addr");
  if (error) throw error;
  return (data?.[0] as { projectId: string; toAddr?: string } | undefined) ?? null;
}

// Records the Message-ID Resend gave a send, once: the next email on the
// thread then names it in In-Reply-To, and replies thread under it. An id
// already recorded is never replaced.
export async function noteMessageId(resendId: string, messageId: string): Promise<void> {
  if (!isClientsStoreConfigured() || !resendId || !messageId.trim()) return;
  const { error } = await db()
    .from(TABLE)
    .update({ message_id: messageId.trim() })
    .eq("resend_id", resendId)
    .is("message_id", null);
  if (error) throw error;
}

export async function setMessageStatus(id: string, status: MessageStatus, detail?: string) {
  if (!isClientsStoreConfigured()) return;
  const { error } = await db()
    .from(TABLE)
    .update({ status, status_detail: detail ?? null })
    .eq("id", id);
  if (error) throw error;
}

// Messages still at "sent" after `olderThanHours`: the daily check asks Resend
// what became of them, in case a webhook never arrived.
export async function listUnsettledSends(olderThanHours: number) {
  if (!isClientsStoreConfigured()) return [];
  const before = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  const { data, error } = await db()
    .from(TABLE)
    .select("resendId:resend_id")
    .eq("status", "sent")
    .not("resend_id", "is", null)
    .lt("sent_at", before)
    .limit(50);
  if (error) throw error;
  return ((data as { resendId: string }[] | null) ?? []).map((r) => r.resendId);
}

// The latest message's Message-ID, so the next email can say it's a reply and
// mail apps keep the conversation together.
export async function lastMessageId(projectId: string): Promise<string | undefined> {
  if (!isClientsStoreConfigured()) return undefined;
  const { data, error } = await db()
    .from(TABLE)
    .select("messageId:message_id")
    .eq("project_id", projectId)
    .not("message_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { messageId?: string } | null)?.messageId;
}

// ── Reply tokens ──

export async function ensureReplyToken(projectId: string): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await db()
    .from("client_records")
    .select("reply_token")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.reply_token) return data.reply_token as string;
  const token = randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "");
  const { error: upErr } = await db()
    .from("client_records")
    .update({ reply_token: token })
    .eq("id", projectId)
    .is("reply_token", null);
  if (upErr) throw upErr;
  // A concurrent send may have set one first; read back whichever won.
  const { data: again } = await db()
    .from("client_records")
    .select("reply_token")
    .eq("id", projectId)
    .maybeSingle();
  return (again?.reply_token as string | undefined) ?? token;
}

export type ThreadProject = {
  id: string;
  email: string;
  clientName?: string;
  projectName?: string;
  serviceType?: string;
  eventDate?: string;
  collaboratorEmails: string[];
};

export async function findProjectByReplyToken(token: string): Promise<ThreadProject | null> {
  if (!isClientsStoreConfigured() || !token) return null;
  const { data, error } = await db()
    .from("client_records")
    .select(
      "id, email, clientName:client_name, projectName:project_name, serviceType:service_type, eventDate:event_date, collaboratorEmails:collaborator_emails",
    )
    .eq("reply_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as ThreadProject;
  return { ...row, collaboratorEmails: row.collaboratorEmails ?? [] };
}

// The owner's own recent writing to clients (composed here, answered from
// Gmail, or filed from Gmail), newest first, leaving out what began as an AI
// draft so the drafter never learns from itself. The email drafter learns his
// voice from it; src/lib/ai/voice-samples.ts redacts it first.
export async function listOwnerWriting(
  excludeProjectId: string,
  limit = 12,
): Promise<{ bodyText: string; names: string[] }[]> {
  if (!isClientsStoreConfigured()) return [];
  const read = () => {
    let q = db()
      .from(TABLE)
      .select("bodyText:body_text, client:client_records(client_name, partner_name)")
      .eq("direction", "out")
      .in("kind", ["compose", "relay", "imported"])
      .in("status", ["sent", "delivered", "delayed"])
      .neq("project_id", excludeProjectId)
      .not("body_text", "is", null);
    if (has("aiDrafted")) q = q.eq("ai_drafted", false);
    return q.order("sent_at", { ascending: false }).limit(limit);
  };
  let { data, error } = await read();
  if (laterColumnMissing(error)) ({ data, error } = await read());
  if (error) throw error;
  type Row = { bodyText: string; client: { client_name?: string; partner_name?: string } | null };
  return ((data as unknown as Row[] | null) ?? []).map((r) => ({
    bodyText: r.bodyText,
    names: [r.client?.client_name, r.client?.partner_name].filter((n): n is string => !!n),
  }));
}
