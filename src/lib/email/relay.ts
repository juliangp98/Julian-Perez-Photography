// What happens to Resend webhook events. Delivery events update the thread
// message they belong to. Mail received at a project's address is filed on its
// thread, then: a client's reply is forwarded to the owner's inbox (with the
// reply address as Reply-To, so answering from Gmail goes back through the
// site); the owner's reply is relayed to the client once DKIM shows it really
// came from the owner; anything else is held for review and never reaches the
// client.

import { Resend, type WebhookEventPayload } from "resend";
import { render } from "@react-email/components";
import { getSiteSettings } from "@/lib/content";
import { isAdminEmail } from "@/lib/auth";
import { TransientError, withRetry } from "@/lib/retry";
import {
  ensureReplyToken,
  findProjectByReplyToken,
  listUnsettledSends,
  recordMessage,
  updateMessageStatus,
  type MessageAttachment,
  type MessageStatus,
  type ThreadProject,
} from "@/lib/messages";
import { sendEmail } from "./send";
import { resendFrom } from "./email-helpers";
import { BrandedEmailLayout, PipelineEmailTemplate } from "./email-templates";
import {
  addressOf,
  findThreadAddress,
  header,
  isAutomated,
  parseForwarded,
  replyAddress,
  senderAuthenticated,
  stripQuoted,
} from "./inbound";

type ReceivedData = Extract<WebhookEventPayload, { type: "email.received" }>["data"];

const DELIVERY_STATUS: Partial<Record<WebhookEventPayload["type"], MessageStatus>> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "failed",
};

export async function handleWebhookEvent(event: WebhookEventPayload, origin: string) {
  if (event.type === "email.received") return handleReceived(event.data, origin);
  const status = DELIVERY_STATUS[event.type];
  if (!status || !("email_id" in event.data)) return;

  const detail =
    event.type === "email.bounced"
      ? event.data.bounce.message
      : event.type === "email.suppressed"
        ? "Resend suppressed it (this address bounced or complained before)"
        : undefined;
  const updated = await updateMessageStatus(event.data.email_id, status, detail);
  if (updated && (status === "bounced" || status === "complained")) {
    await alertOwner({
      subject: `An email to ${updated.toAddr ?? "a client"} ${status === "bounced" ? "bounced" : "was marked as spam"}`,
      text: [
        status === "bounced"
          ? `Your email to ${updated.toAddr} didn't arrive: ${detail ?? "it bounced"}.`
          : `${updated.toAddr} marked your email as spam, so Resend won't send to them again.`,
        "",
        `Open the thread: ${origin}/admin/projects/${updated.projectId}`,
      ].join("\n"),
    });
  }
}

// Resend's last_event for a sent email → the thread status it implies.
const LAST_EVENT_STATUS: Record<string, MessageStatus> = {
  delivered: "delivered",
  opened: "delivered",
  clicked: "delivered",
  delivery_delayed: "delayed",
  bounced: "bounced",
  complained: "complained",
  failed: "failed",
  suppressed: "failed",
};

// The daily check: ask Resend about thread messages still at "sent" after two
// days, in case their webhook never arrived. Returns how many were settled.
export async function reconcileUnsettledSends(): Promise<number> {
  const ids = await listUnsettledSends(48);
  if (!ids.length || !process.env.RESEND_API_KEY) return 0;
  const resend = new Resend(process.env.RESEND_API_KEY);
  let settled = 0;
  for (const id of ids) {
    const { data } = await resend.emails.get(id);
    const status = data && LAST_EVENT_STATUS[data.last_event];
    if (status && (await updateMessageStatus(id, status))) settled++;
  }
  return settled;
}

async function handleReceived(data: ReceivedData, origin: string) {
  const address = findThreadAddress([...data.to, ...(data.cc ?? [])]);
  if (!address) return;
  const project = await findProjectByReplyToken(address.token);
  if (!project) return;

  const full = await fetchReceived(data.email_id);
  const from = addressOf(data.from);
  const settings = await getSiteSettings();
  const isOwner = isAdminEmail(from) || from === addressOf(settings.contactEmail);
  const verified = senderAuthenticated(full.headers, from);
  const attachments: MessageAttachment[] = (full.attachments ?? []).map((a) => ({
    id: a.id,
    filename: a.filename ?? "attachment",
    contentType: a.content_type,
    size: a.size,
  }));
  const base = {
    projectId: project.id,
    fromAddr: data.from,
    toAddr: data.to.join(", "),
    subject: data.subject,
    messageId: full.message_id,
    inReplyTo: header(full.headers, "in-reply-to") || undefined,
    attachments,
    sentAt: data.created_at,
  };
  const text = full.text ?? "";

  // Out-of-office notices, bounces and anything from the site's own sending
  // address (a loop) are kept on the record but go nowhere.
  if (isAutomated(full.headers) || from === addressOf(resendFrom())) {
    await recordMessage({
      ...base,
      direction: "in",
      kind: "reply",
      bodyText: stripQuoted(text) || text,
      resendId: data.email_id,
      status: "dropped",
      statusDetail: "An automatic reply, so it wasn't forwarded.",
    });
    return;
  }

  if (address.mode === "log") return fileFromGmail(project, data, text, isOwner && verified);

  if (isOwner) {
    const body = stripQuoted(text);
    if (!body) return;
    if (!verified) {
      await recordMessage({
        ...base,
        direction: "out",
        kind: "relay",
        toAddr: project.email,
        bodyText: body,
        resendId: data.email_id,
        status: "unverified",
        statusDetail:
          "Sent from your address, but the sender couldn't be verified, so it's waiting for you to send it.",
      });
      return;
    }
    await relayToClient(project, data.subject, body, `relay-${data.email_id}`);
    return;
  }

  const knownSender =
    from === addressOf(project.email) || project.collaboratorEmails.includes(from);
  const body = stripQuoted(text) || text;
  const isNew = await recordMessage({
    ...base,
    direction: "in",
    kind: "reply",
    bodyText: body,
    resendId: data.email_id,
    status: knownSender ? "received" : "unverified",
    statusDetail: knownSender
      ? undefined
      : "From an address that isn't on this project, so it's only shown to you.",
  });
  // A webhook retry of a reply already filed: it was forwarded the first time.
  if (!isNew) return;
  await forwardToOwner(project, {
    from: data.from,
    subject: data.subject,
    body,
    attachments,
    messageId: full.message_id,
    references: header(full.headers, "references"),
    flagged: !knownSender,
    origin,
  });
}

// The owner forwarded mail from Gmail to log+<token>@: file each forwarded
// message on the thread with its original sender and date. Nothing is sent.
async function fileFromGmail(
  project: ThreadProject,
  data: ReceivedData,
  text: string,
  trusted: boolean,
) {
  if (!trusted) {
    await recordMessage({
      projectId: project.id,
      direction: "in",
      kind: "imported",
      fromAddr: data.from,
      subject: data.subject,
      bodyText: text,
      resendId: data.email_id,
      status: "unverified",
      statusDetail: "Sent to the filing address by someone other than you, so it's only shown to you.",
    });
    return;
  }
  const settings = await getSiteSettings();
  const forwarded = parseForwarded(text);
  const items = forwarded.length
    ? forwarded
    : [{ from: data.from, subject: data.subject, body: stripQuoted(text) || text, date: data.created_at }];
  for (const [i, m] of items.entries()) {
    const sender = addressOf(m.from);
    const fromOwner = isAdminEmail(sender) || sender === addressOf(settings.contactEmail);
    await recordMessage({
      projectId: project.id,
      direction: fromOwner ? "out" : "in",
      kind: "imported",
      fromAddr: m.from,
      subject: m.subject,
      bodyText: m.body,
      idempotencyKey: `import-${data.email_id}-${i}`,
      status: fromOwner ? "sent" : "received",
      sentAt: m.date,
    });
  }
}

// Sends the owner's words to the project's client on the thread, in the same
// branded layout as a composed email. Used for replies from Gmail and for
// held messages the owner releases from the admin thread.
export async function relayToClient(
  project: { id: string; email?: string },
  subject: string,
  body: string,
  idempotencyKey: string,
) {
  if (!project.email) throw new Error("No client email on file");
  const html = await render(
    BrandedEmailLayout({ preview: subject, children: PipelineEmailTemplate({ body }) }),
  );
  await sendEmail({
    to: project.email,
    subject,
    text: body,
    html,
    idempotencyKey,
    thread: { projectId: project.id, kind: "relay" },
  });
}

export async function forwardToOwner(
  project: Pick<ThreadProject, "id" | "clientName" | "projectName">,
  m: {
    from: string;
    subject: string;
    body: string;
    attachments?: MessageAttachment[];
    messageId?: string;
    references?: string;
    flagged?: boolean;
    origin: string;
    viaPortal?: boolean;
  },
) {
  const name = project.projectName || project.clientName || "a project";
  const token = await ensureReplyToken(project.id);
  const lines = [
    m.flagged
      ? `${m.from} wrote on ${name}'s thread. That address isn't on the project, so the client can't see it and nothing was relayed. Check it before you answer.`
      : `${m.from} ${m.viaPortal ? "wrote in the portal" : "replied"} on ${name}:`,
    "",
    m.body,
  ];
  if (m.attachments?.length) {
    lines.push("", `Attachments: ${m.attachments.map((a) => a.filename).join(", ")} (open the thread to see them).`);
  }
  lines.push("", `Open the thread: ${m.origin}/admin/projects/${project.id}`);
  if (!m.flagged) lines.push("Reply to this email and it goes to the client from the studio address, on the thread.");

  const references = [m.references, m.messageId].filter(Boolean).join(" ");
  await alertOwner({
    subject: `${m.flagged ? "[Held for review] " : ""}${m.subject || `New message on ${name}`}`,
    text: lines.join("\n"),
    replyTo: m.flagged ? undefined : token ? replyAddress(token) : undefined,
    headers: m.messageId ? { "In-Reply-To": m.messageId, References: references } : undefined,
  });
}

async function alertOwner(email: {
  subject: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}) {
  const settings = await getSiteSettings();
  await sendEmail({ to: process.env.INQUIRY_TO || settings.contactEmail, ...email });
}

async function fetchReceived(id: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return withRetry(async () => {
    const { data, error } = await resend.emails.receiving.get(id);
    if (data) return data;
    if (error?.statusCode === null || (error?.statusCode ?? 0) >= 500) {
      throw new TransientError(error?.message ?? "Resend unavailable");
    }
    throw new Error(`Couldn't fetch received email ${id}: ${error?.message}`);
  });
}
