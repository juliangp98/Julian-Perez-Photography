import { test, expect } from "@playwright/test";
import { linkParts } from "../../src/lib/linkify";
import { addressesIn, fromClient, senderLabel, visibleToClient } from "../../src/lib/message-visibility";
import { answersAlert, clientSubject, isSiteMail, SITE_MAIL_HEADER } from "../../src/lib/email/inbound";

// How a project's thread reads: web addresses become links, the client sees
// only what passed between them and Julian, other senders are named for the
// owner, Julian's answer to an alert keeps the thread's subject, and mail the
// site sent itself is recognised. Pure, no browser.

const CLIENT = "Avery <Avery@Example.com>";

test("addresses in a message become links, without the sentence's punctuation", () => {
  expect(linkParts("See https://x.com/a. Then reply.")).toEqual([
    { text: "See " },
    { text: "https://x.com/a", href: "https://x.com/a" },
    { text: ". Then reply." },
  ]);
  // A bracket the address didn't open stays outside; one it opened stays in.
  expect(linkParts("(the gallery: https://x.com/g)")).toEqual([
    { text: "(the gallery: " },
    { text: "https://x.com/g", href: "https://x.com/g" },
    { text: ")" },
  ]);
  expect(linkParts("https://en.wikipedia.org/wiki/Foo_(bar)")[0].href).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  expect(linkParts("Two: http://a.com, https://b.com/x?y=1!").filter((p) => p.href).map((p) => p.href)).toEqual([
    "http://a.com",
    "https://b.com/x?y=1",
  ]);
  // Only http(s).
  expect(linkParts("javascript:alert(1) and mailto:a@b.com")).toEqual([{ text: "javascript:alert(1) and mailto:a@b.com" }]);
  expect(linkParts("")).toEqual([]);
});

test("the client sees their own writing and what Julian sent them, and nothing filed from others", () => {
  const msg = (m: Partial<Parameters<typeof visibleToClient>[0]>) =>
    visibleToClient({ direction: "in", channel: "email", kind: "reply", status: "received", ...m }, CLIENT);
  // Theirs: mail from their address (any case), a portal post, a repeat inquiry.
  expect(msg({ fromAddr: "avery@example.com" })).toBe(true);
  expect(msg({ channel: "portal" })).toBe(true);
  expect(msg({ kind: "inquiry" })).toBe(true);
  // A second photographer's reply, or a venue's mail Julian filed.
  expect(msg({ fromAddr: "Second <second@shooters.com>" })).toBe(false);
  expect(msg({ kind: "imported", fromAddr: "events@venue.com" })).toBe(false);
  // Held or dropped mail stays the owner's, theirs or not.
  expect(msg({ fromAddr: "avery@example.com", status: "unverified" })).toBe(false);
  expect(msg({ fromAddr: "avery@example.com", status: "dropped" })).toBe(false);

  const out = (m: Partial<Parameters<typeof visibleToClient>[0]>) =>
    visibleToClient({ direction: "out", channel: "email", kind: "compose", status: "sent", ...m }, CLIENT);
  expect(out({})).toBe(true);
  expect(out({ kind: "relay", status: "delivered" })).toBe(true);
  expect(out({ kind: "confirmation" })).toBe(true);
  expect(out({ status: "bounced" })).toBe(false);
  // Julian's mail filed from Gmail: shown only when it was to them.
  expect(out({ kind: "imported", toAddr: "Avery <avery@example.com>, partner@example.com" })).toBe(true);
  expect(out({ kind: "imported", toAddr: "events@venue.com" })).toBe(false);
  expect(out({ kind: "imported" })).toBe(false);

  expect(fromClient({ direction: "in", channel: "email", kind: "reply", fromAddr: "avery@example.com" }, undefined)).toBe(false);
  expect(addressesIn('"Smith, Avery" <A@x.com>; b@y.com')).toEqual(["a@x.com", "b@y.com"]);
});

test("someone else on the thread is named by their display name, else their address", () => {
  expect(senderLabel("Riverside Venue <events@venue.com>")).toBe("Riverside Venue");
  expect(senderLabel('"Sam Lee" <sam@x.com>')).toBe("Sam Lee");
  expect(senderLabel("sam@x.com")).toBe("sam@x.com");
  expect(senderLabel(undefined)).toBe("Someone else");
});

test("an answer to one of the site's alerts reaches the client under the thread's subject", () => {
  expect(answersAlert("Re: New message on Avery's Wedding")).toBe(true);
  expect(answersAlert("RE: [Held for review] Question")).toBe(true);
  expect(answersAlert("Re: Your proposal")).toBe(false);
  expect(clientSubject("Re: New message on Avery's Wedding", "Your proposal for Avery's Wedding")).toBe(
    "Re: Your proposal for Avery's Wedding",
  );
  expect(clientSubject("Re: [Held for review] Hi", "Re: Re: Timeline")).toBe("Re: Timeline");
  expect(clientSubject("Re: New message on X", undefined, "Avery's Wedding")).toBe("Re: Avery's Wedding");
  expect(clientSubject("", undefined, undefined)).toBe("Re: Your project");
  // His own subject stands.
  expect(clientSubject("Re: Timeline questions", "Other")).toBe("Re: Timeline questions");
});

test("mail the site sent itself is recognised by its marker header", () => {
  expect(isSiteMail({ [SITE_MAIL_HEADER]: "site" })).toBe(true);
  expect(isSiteMail({ "x-jpp-sent-by": "Site" })).toBe(true);
  expect(isSiteMail({ "X-Other": "site" })).toBe(false);
  expect(isSiteMail(undefined)).toBe(false);
});
