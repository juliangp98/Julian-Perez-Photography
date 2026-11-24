// The per-project message thread (client_messages): every email the site sends
// a client, its delivery status, replies that come back through the project's
// reply address, and messages posted in the portal. Server-only, service-role.

import "server-only";
import { randomBytes } from "node:crypto";
import { db, isClientsStoreConfigured } from "@/lib/clients";

const TABLE = "client_messages";

export type MessageDirection = "in" | "out";
export type MessageKind =
  | "compose"
  | "update"
  | "confirmation"
  | "relay"
  | "reply"
  | "portal"
  | "imported";
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
};

const SELECT =
  "id, projectId:project_id, direction, channel, kind, fromAddr:from_addr, toAddr:to_addr, subject, bodyText:body_text, resendId:resend_id, messageId:message_id, inReplyTo:in_reply_to, status, statusDetail:status_detail, attachments, sentAt:sent_at";

// What the client may see of their own thread: nothing held back for review.
const CLIENT_VISIBLE: MessageStatus[] = ["sent", "delivered", "delayed", "received"];

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
};

// Records a message and returns whether it was new. A repeat of the same Resend
// id or idempotency key (a webhook retry, a double-submitted send) is ignored
// rather than duplicated, and returns false.
export async function recordMessage(m: NewMessage): Promise<boolean> {
  if (!isClientsStoreConfigured()) return false;
  const { error } = await db().from(TABLE).insert({
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
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

export async function listProjectMessages(
  projectId: string,
  opts: { clientView?: boolean } = {},
): Promise<ClientMessage[]> {
  if (!isClientsStoreConfigured()) return [];
  let q = db().from(TABLE).select(SELECT).eq("project_id", projectId);
  if (opts.clientView) q = q.in("status", CLIENT_VISIBLE);
  const { data, error } = await q.order("sent_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as ClientMessage[] | null) ?? [];
}

export async function getMessage(id: string): Promise<ClientMessage | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await db().from(TABLE).select(SELECT).eq("id", id).maybeSingle();
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
