import { test, expect } from "@playwright/test";
import { pickVoiceSamples, redactForStyle, voiceSection } from "../../src/lib/ai/voice-samples";

// The drafter learns Julian's voice from emails he sent other clients; these
// check that nothing identifying another client survives into the prompt.

test("redacts names, addresses, links and phone numbers", () => {
  const text = [
    "Hi Avery and Sam,",
    "",
    "Great to see you both at Meridian Hill. Call me at (703) 555-1234 or write to avery@example.com.",
    "Your gallery: https://gallery.example.com/avery-sam",
    "",
    "Julian",
  ].join("\n");
  const out = redactForStyle(text, ["Avery Example", "Sam Smith"]);
  expect(out).toContain("Hi [name],");
  expect(out).not.toMatch(/Avery|Sam\b|555-1234|example\.com|https?:/);
  expect(out).toContain("[phone]");
  expect(out).toContain("[email]");
  expect(out).toContain("[link]");
  expect(out).toContain("Meridian Hill"); // places aren't names on file; the prompt forbids copying facts
});

test("keeps up to three substantial samples, trimmed", () => {
  const long = "Thanks for the call today. ".repeat(60);
  const rows = [
    { bodyText: "Too short.", names: [] },
    { bodyText: long, names: [] },
    { bodyText: long, names: [] },
    { bodyText: long, names: [] },
    { bodyText: long, names: [] },
  ];
  const samples = pickVoiceSamples(rows);
  expect(samples).toHaveLength(3);
  for (const s of samples) expect(s.length).toBeLessThanOrEqual(900);
});

test("adds no prompt section before there's any history", () => {
  expect(voiceSection([])).toEqual([]);
  expect(voiceSection(["Hi [name],\n\nThanks.\n\nJulian"]).join("\n")).toContain("<example 1>");
});
