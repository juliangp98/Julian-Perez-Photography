import { test, expect } from "@playwright/test";
import {
  findThreadAddress,
  isAutomated,
  parseForwarded,
  senderAuthenticated,
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

test("trusts a sender only on a passing DKIM signature from their own domain", () => {
  const pass = {
    "Authentication-Results": "mx.resend.com; dkim=pass header.i=@gmail.com header.s=20230601; spf=pass",
  };
  expect(senderAuthenticated(pass, "Julian <julian@gmail.com>")).toBe(true);
  expect(senderAuthenticated(pass, "julian@example.com")).toBe(false);
  expect(
    senderAuthenticated({ "authentication-results": "mx; dkim=fail header.d=gmail.com" }, "julian@gmail.com"),
  ).toBe(false);
  expect(senderAuthenticated(null, "julian@gmail.com")).toBe(false);
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
  expect(m.body).toBe("Can we move the call to Thursday?");
  expect(m.date && new Date(m.date).getUTCDate()).toBe(17);
  expect(parseForwarded("Just a note, nothing forwarded.")).toEqual([]);
});
