import { test, expect } from "@playwright/test";
import {
  findThreadAddress,
  isAutomated,
  parseForwarded,
  ownerVerified,
  addressOf,
  oneAddress,
  stripQuoted,
} from "../../src/lib/email/inbound";

// The pure pieces of inbound mail handling, run without a browser or server.

test.beforeAll(() => {
  process.env.RESEND_INBOUND_DOMAIN = "in.example.test";
});

test("finds the project token in a reply or filing address", () => {
  expect(findThreadAddress(["Julian <reply+abc123@in.example.test>"])).toEqual({
    mode: "reply",
    token: "abc123",
  });
  expect(findThreadAddress(["someone@else.test", "log+xyz9@IN.example.test"])).toEqual({
    mode: "log",
    token: "xyz9",
  });
  // Same local part on another domain is not ours.
  expect(findThreadAddress(["reply+abc123@evil.test"])).toBeNull();
});

test("strips the quoted history from a reply", () => {
  const gmail = [
    "Sounds great, see you Saturday!",
    "",
    "On Mon, Nov 17, 2026 at 3:04 PM Julian Perez Photography <",
    "noreply@julianperezphotography.com> wrote:",
    "> Hi Avery, confirming 2pm.",
  ].join("\n");
  expect(stripQuoted(gmail)).toBe("Sounds great, see you Saturday!");

  const outlook = "Yes please.\r\n\r\n-----Original Message-----\r\nFrom: Julian";
  expect(stripQuoted(outlook)).toBe("Yes please.");

  expect(stripQuoted("No quote here.")).toBe("No quote here.");
});

test("recognizes automatic replies", () => {
  expect(isAutomated({ "Auto-Submitted": "auto-replied" })).toBe(true);
  expect(isAutomated({ precedence: "bulk" })).toBe(true);
  expect(isAutomated({ "X-Autoreply": "yes" })).toBe(true);
  expect(isAutomated({ "Auto-Submitted": "no" })).toBe(false);
  expect(isAutomated(null)).toBe(false);
});

test("trusts a sender only on Resend's own DKIM or DMARC pass, never on the message's headers", () => {
  expect(ownerVerified({ dkim: "pass", spf: "pass", dmarc: "pass" })).toBe(true);
  expect(ownerVerified({ dkim: "gray", dmarc: "pass" })).toBe(true);
  // Unsigned, or signed by another domain (Gmail's own signature on julian@ mail).
  expect(ownerVerified({ dkim: "gray", spf: "pass", dmarc: "fail" })).toBe(false);
  expect(ownerVerified({ dkim: "fail", dmarc: "fail" })).toBe(false);
  // No result at all (older mail, or a field the API dropped).
  expect(ownerVerified(null)).toBe(false);
  expect(ownerVerified(undefined)).toBe(false);
  expect(ownerVerified({})).toBe(false);
});

test("reads the address a From line ends with, and knows a line with more than one", () => {
  expect(addressOf("Avery <Avery@Example.com>")).toBe("avery@example.com");
  expect(addressOf("avery@example.com")).toBe("avery@example.com");
  // An address written into the display name isn't the sender's.
  expect(addressOf('"<julian@julianperezphotography.com>" <x@evil.test>')).toBe("x@evil.test");
  expect(oneAddress("Julian Perez <julian@julianperezphotography.com>")).toBe(true);
  expect(oneAddress('"<julian@julianperezphotography.com>" <x@evil.test>')).toBe(false);
  expect(oneAddress("x@evil.test (<julian@julianperezphotography.com>)")).toBe(false);
  expect(oneAddress("julian@julianperezphotography.com, x@evil.test")).toBe(false);
  // Read as Julian's, but with a second address in the line it isn't proof.
  expect(addressOf('"x@evil.test" <julian@julianperezphotography.com>')).toBe("julian@julianperezphotography.com");
  expect(oneAddress('"x@evil.test" <julian@julianperezphotography.com>')).toBe(false);
});

test("reads Gmail's forwarded-message blocks", () => {
  const text = [
    "Filing this one.",
    "",
    "---------- Forwarded message ---------",
    "From: Avery Example <avery@example.com>",
    "Date: Mon, Nov 17, 2026 at 3:04 PM",
    "Subject: Re: Your wedding",
    "To: <julian@example.com>",
    "",
    "Can we move the call to Thursday?",
    "",
    "On Sun, Nov 16, 2026 Julian wrote:",
    "> How's Wednesday?",
  ].join("\n");
  const [m] = parseForwarded(text);
  expect(m.from).toBe("Avery Example <avery@example.com>");
  expect(m.subject).toBe("Re: Your wedding");
  // Who it was to, so the portal shows the client only what was theirs.
  expect(m.to).toBe("<julian@example.com>");
  expect(m.body).toBe("Can we move the call to Thursday?");
  expect(m.date && new Date(m.date).getUTCDate()).toBe(17);
  expect(parseForwarded("Just a note, nothing forwarded.")).toEqual([]);
});
