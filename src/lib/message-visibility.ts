// Who sees which message on a project's thread, and who it's from. The client
// sees what passed between them and Julian: their own portal posts, inquiries
// and mail from their own address, and what Julian sent them. Mail Julian
// files from others (a venue, a second photographer) stays his alone, and only
// the client's own writing counts as them writing. Pure, so the views, the
// last-contact rules and the specs share it.

import { addressOf } from "./email/inbound";
import type { ClientMessage, MessageStatus } from "./messages";

// What the client may see of their own thread: nothing held back for review.
export const CLIENT_VISIBLE: MessageStatus[] = ["sent", "delivered", "delayed", "received"];

type Sender = Pick<ClientMessage, "direction" | "channel" | "kind" | "fromAddr">;

// The addresses in a To or Cc value ("Avery <a@x.com>, b@y.com").
export function addressesIn(value?: string): string[] {
  return (value?.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) ?? []).map((a) => addressOf(a));
}

// Whether an incoming message is the client's own: a portal post, an inquiry,
// or mail from the address on the project.
export function fromClient(m: Sender, clientEmail?: string): boolean {
  if (m.direction !== "in") return false;
  if (m.channel === "portal" || m.kind === "inquiry") return true;
  return !!clientEmail && !!m.fromAddr && addressOf(m.fromAddr) === addressOf(clientEmail);
}

// Whether the client sees a message in their portal. Mail Julian filed from
// Gmail shows only when it was to them; an old filed message with no
// recipient recorded stays hidden rather than guessed.
export function visibleToClient(
  m: Sender & Pick<ClientMessage, "status" | "toAddr">,
  clientEmail?: string,
): boolean {
  if (!CLIENT_VISIBLE.includes(m.status)) return false;
  if (m.direction === "in") return fromClient(m, clientEmail);
  if (m.kind !== "imported") return true;
  return !!clientEmail && addressesIn(m.toAddr).includes(addressOf(clientEmail));
}

// A sender as the owner's thread names them: the display name, else the
// address ("Riverside Venue <events@x.com>" → "Riverside Venue").
export function senderLabel(fromAddr?: string): string {
  if (!fromAddr) return "Someone else";
  const name = fromAddr.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return name || addressOf(fromAddr);
}
