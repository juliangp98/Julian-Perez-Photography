import { formatDateTime } from "@/lib/field-format";
import type { ClientMessage, MessageKind, MessageStatus } from "@/lib/messages";
import { linkParts } from "@/lib/linkify";
import { fromClient, senderLabel } from "@/lib/message-visibility";
import ReleaseHeldReply from "./ReleaseHeldReply";

// A project's messages, oldest first. The owner sees everything, including
// what was held or not forwarded, with mail from anyone other than the client
// named and marked as theirs alone; the client sees only what passed between
// them (the server already filters that for the client view). Web addresses
// in a message are links.

const STATUS: Record<MessageStatus, { label: string; tone: "muted" | "good" | "bad" }> = {
  sent: { label: "Sent", tone: "muted" },
  delivered: { label: "Delivered", tone: "good" },
  delayed: { label: "Delayed", tone: "muted" },
  bounced: { label: "Bounced", tone: "bad" },
  complained: { label: "Marked as spam", tone: "bad" },
  failed: { label: "Not sent", tone: "bad" },
  received: { label: "Received", tone: "muted" },
  unverified: { label: "Held for review", tone: "bad" },
  dropped: { label: "Not forwarded", tone: "muted" },
};

const KIND: Record<MessageKind, string> = {
  compose: "Email",
  update: "Project update",
  confirmation: "Confirmation",
  relay: "Reply from Gmail",
  reply: "Reply",
  portal: "Portal",
  imported: "Filed from Gmail",
  inquiry: "Inquiry form",
};

const TONE = {
  muted: "text-muted",
  good: "text-accent",
  bad: "text-danger",
};

export default function MessageThread({
  messages,
  viewer,
  clientLabel,
  clientEmail,
}: {
  messages: ClientMessage[];
  viewer: "owner" | "client";
  clientLabel: string;
  // The address on the project, so the owner's view can tell the client's
  // mail from someone else's.
  clientEmail?: string;
}) {
  if (!messages.length) {
    return (
      <p className="text-sm text-muted">
        {viewer === "owner"
          ? "No messages yet. Emails sent from here, replies, and portal messages all land on this thread."
          : "No messages yet."}
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Messages">
      {messages.map((m) => {
        const fromStudio = m.direction === "out";
        const someoneElse = viewer === "owner" && !fromStudio && !fromClient(m, clientEmail);
        const who = fromStudio
          ? viewer === "owner"
            ? "You"
            : "Julian"
          : viewer === "client"
            ? "You"
            : someoneElse
              ? senderLabel(m.fromAddr)
              : clientLabel;
        const status = STATUS[m.status];
        return (
          <li
            key={m.id}
            className={`rounded-lg border border-border p-4 ${fromStudio ? "bg-white" : "bg-background"} ${m.status === "dropped" ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="font-medium text-foreground">{who}</span>
                {viewer === "owner" && <span className="text-muted"> · {KIND[m.kind]}</span>}
                {someoneElse && <span className="text-muted"> · Not shown to the client</span>}
              </span>
              <span className="text-muted">
                {formatDateTime(m.sentAt)}
                {viewer === "owner" && (
                  <>
                    {" · "}
                    <span className={TONE[status.tone]}>{status.label}</span>
                  </>
                )}
              </span>
            </div>
            {m.subject && <p className="mt-2 text-sm font-medium">{m.subject}</p>}
            {m.bodyText && (
              <p className="mt-1 text-sm whitespace-pre-line leading-relaxed break-words">
                {linkParts(m.bodyText).map((part, i) =>
                  part.href ? (
                    <a
                      key={i}
                      href={part.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-accent"
                    >
                      {part.text}
                    </a>
                  ) : (
                    part.text
                  ),
                )}
              </p>
            )}
            {m.attachments.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Attachments: {m.attachments.map((a) => a.filename).join(", ")}
              </p>
            )}
            {viewer === "owner" && m.statusDetail && (
              <p className={`mt-2 text-xs ${TONE[status.tone]}`}>{m.statusDetail}</p>
            )}
            {viewer === "owner" && m.status === "unverified" && m.direction === "out" && (
              <ReleaseHeldReply messageId={m.id} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
