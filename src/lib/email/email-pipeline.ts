// Pipeline email templates: starting drafts Julian picks, fills, edits and
// sends from a project. Pure and dependency-free (importable client-side by
// the compose UI). `{{token}}` placeholders are filled from the project; a
// token without a value (and a free-form `[bracket]` prompt) is left visible,
// and Compose won't send while anything in brackets remains. A line holding
// only an optional token (OPTIONAL_TOKENS) is left out when it has no value.
// Links are tokens, never "attached": an email from the site carries no
// attachments.

import type { ClientStatus } from "@/lib/client-status";

// Every {{token}} a template may use. emailTokens() (src/lib/email/
// email-tokens.ts) fills each of them from the project, and a spec checks the
// templates use no other.
export const EMAIL_TOKENS = [
  "firstName",
  "clientName",
  "projectName",
  "serviceNoun",
  "eventDate",
  "venue",
  "portalUrl",
  "questionnaireUrl",
  "bookingUrl",
  "discoveryCallUrl",
  "reviewUrl",
  "proposalUrl",
  "contractUrl",
  "invoiceUrl",
  "invoiceDueDate",
  "highlightsUrl",
  "galleryUrl",
  "timelineUrl",
  "packageName",
  "packagePrice",
  "packageInclusions",
  "sampleGalleryUrl",
  "retainerPercent",
  "holdUntil",
  "paymentMethod",
  "paymentInstructions",
  "questionnaireNudge",
  "planningCallUrl",
] as const;
export type EmailToken = (typeof EMAIL_TOKENS)[number];

// Tokens a template puts on a line of their own, which is left out when the
// project has no value for them: the questionnaire line while it isn't back
// before the shoot, and how to pay while an invoice is open.
export const OPTIONAL_TOKENS: readonly EmailToken[] = ["questionnaireNudge", "paymentInstructions"];

// A follow-up a template sets when it's sent: so many days out, or so many
// months after the event date. `note` says what the follow-up is for.
export type TemplateFollowUp =
  | { days: number; note: string }
  | { monthsAfterEvent: number; note: string };

export type EmailTemplate = {
  id: string;
  name: string;
  // A pipeline stage the template best fits — used to order + group the picker.
  // Values mirror the canonical client statuses in `client-status.ts`.
  stage: string;
  subject: string;
  body: string;
  // What sending it does to the project, applied once the email has gone
  // (see src/lib/email/send-effects.ts):
  // moves the project forward to this status (never back, never out of a
  // closed project);
  advancesTo?: ClientStatus;
  // or closes it with this status, clearing its follow-up and hold;
  closesAs?: ClientStatus;
  // sets the project's next follow-up;
  followUp?: TemplateFollowUp;
  // and holds the date for the service's hold days, unless a hold is running;
  holdsDate?: boolean;
  // and clears a follow-up the pipeline set at a stage before the one it
  // moves to (one a template for an earlier stage or the call summary set),
  // which it settles; one set by hand, or by a later stage, stays.
  settlesFollowUp?: boolean;
};

// The full set, ordered along the communication pipeline (new inquiry →
// wrap-up + re-engagement). The compose picker groups consecutive same-stage
// templates, so order here drives the picker's layout.
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "inquiry-reply",
    name: "Inquiry reply",
    stage: "new-inquiry",
    subject: "Your {{serviceNoun}} inquiry",
    body: `Hi {{firstName}},

Thanks for getting in touch about your {{serviceNoun}}.

[A line or two answering something specific they shared.]

The easiest next step is a short call, 15 to 20 minutes, so I can hear what you have in mind and answer your questions. You can pick a time here: {{discoveryCallUrl}}

{{questionnaireNudge}}

Talk soon,
Julian`,
    advancesTo: "responded",
    followUp: { days: 3, note: "Follow up on the inquiry reply" },
  },
  {
    id: "not-available",
    name: "Not available (offer alternatives)",
    stage: "new-inquiry",
    subject: "About your {{serviceNoun}} date",
    body: `Hi {{firstName}},

Thank you for thinking of me for your {{serviceNoun}}. I'm already booked on {{eventDate}}, so I can't photograph it.

[Optional: I'm glad to recommend a couple of photographers I trust for your date. Just say so and I'll send their details.]

If your plans change, please write again. I'd like to work with you another time.

All the best,
Julian`,
    closesAs: "archived",
  },
  {
    id: "discovery-invite",
    name: "Discovery-call invite",
    stage: "responded",
    subject: "A quick call about your {{serviceNoun}}",
    body: `Hi {{firstName}},

I'd like to hear more about your {{serviceNoun}}. A 15 to 20 minute call is the easiest way for me to answer your questions and get a sense of what you're picturing.

Pick any time that works here: {{discoveryCallUrl}}

If none of those fit, reply with a couple of times that suit you and I'll make one work.

{{questionnaireNudge}}

Julian`,
    advancesTo: "responded",
    followUp: { days: 3, note: "Follow up on the call invite" },
  },
  {
    id: "discovery-recap",
    name: "Recap and proposal (after the call)",
    stage: "in-conversation",
    subject: "So good talking, {{firstName}}: your {{eventDate}} {{serviceNoun}}",
    body: `Hi {{firstName}},

It was good to connect today, and thank you for walking me through your plans for your {{serviceNoun}} on {{eventDate}} at {{venue}}. [One line calling back to something they said on the call.]

From everything you shared, [2 or 3 of their priorities], I think we'd be a great fit, and I'd love to photograph it.

Based on our conversation, I'd recommend {{packageName}} ({{packagePrice}}):
{{packageInclusions}}

Here's the full proposal: {{proposalUrl}}
And a gallery of my work, so you can see how I'd tell your story: {{sampleGalleryUrl}}

To book, I ask for a signed agreement and a {{retainerPercent}}% retainer. Your date is open, and I'm holding it for you until {{holdUntil}}, no pressure, while you decide.

Take your time, and reply with any questions. I'm always glad to hop on another quick call: {{discoveryCallUrl}}

{{questionnaireNudge}}

Looking forward to hopefully being part of your day,
Julian`,
    advancesTo: "proposal-sent",
    holdsDate: true,
    followUp: { days: 6, note: "Follow up on the proposal" },
  },
  {
    id: "proposal",
    name: "Proposal (no call)",
    stage: "proposal-sent",
    subject: "Your proposal for {{projectName}}",
    body: `Hi {{firstName}},

As promised, here's my proposal for {{projectName}} on {{eventDate}}: {{proposalUrl}}

For what you described, I'd recommend {{packageName}} ({{packagePrice}}):
{{packageInclusions}}

Here's a gallery of my work, so you can picture the day: {{sampleGalleryUrl}}

To book, I ask for a signed agreement and a {{retainerPercent}}% retainer. Your date is open, and I'm holding it for you until {{holdUntil}} while you decide.

Reply with any questions, or pick a time for a quick call: {{discoveryCallUrl}}

{{questionnaireNudge}}

Julian`,
    advancesTo: "proposal-sent",
    holdsDate: true,
    followUp: { days: 6, note: "Follow up on the proposal" },
  },
  {
    id: "proposal-follow-up",
    name: "Proposal follow-up",
    stage: "proposal-sent",
    subject: "Following up on your proposal",
    body: `Hi {{firstName}},

I wanted to check that my proposal for {{projectName}} reached you, and see whether any questions have come up. Here it is again: {{proposalUrl}}

Choosing a photographer takes time, so there's no rush. Your date is held for you until {{holdUntil}}. If it would help to talk through collections, coverage or the timeline, I'm happy to get on a call: {{discoveryCallUrl}}

{{questionnaireNudge}}

Julian`,
    followUp: { days: 7, note: "Last check-in on the proposal" },
  },
  {
    id: "contract-deposit",
    name: "Contract & retainer",
    stage: "booked",
    subject: "Two steps to reserve {{eventDate}}",
    body: `Hi {{firstName}},

I'm glad you'd like to go ahead. Two things reserve your date:

1. Sign the agreement: {{contractUrl}}
2. Pay the {{retainerPercent}}% retainer: {{invoiceUrl}}
{{paymentInstructions}}

Once both are in, the date is yours and we can start planning. Everything is in your client portal as we go: {{portalUrl}}

{{questionnaireNudge}}

Let me know if anything comes up.

Julian`,
    advancesTo: "booked",
    followUp: { days: 3, note: "Check the agreement and retainer came in" },
  },
  {
    id: "payment-reminder",
    name: "Payment reminder",
    stage: "booked",
    subject: "Payment due {{invoiceDueDate}} for {{projectName}}",
    body: `Hi {{firstName}},

A reminder that your [retainer / balance] for {{projectName}} is due on {{invoiceDueDate}}.

You can pay here whenever it suits you: {{invoiceUrl}}
{{paymentInstructions}}

If you have questions about the invoice, just reply.

{{questionnaireNudge}}

Thank you,
Julian`,
  },
  {
    id: "booking-welcome",
    name: "Booking welcome",
    stage: "contract-signed",
    subject: "You're booked for {{eventDate}}",
    body: `Hi {{firstName}},

It's official: I'm photographing {{projectName}}. Thank you for choosing me, and for sending back the agreement and retainer.

Your client portal has everything in one place: your status, dates, links and files, and a way to write to me: {{portalUrl}}

{{questionnaireNudge}}

Reply any time with questions.

Julian`,
    advancesTo: "contract-signed",
    settlesFollowUp: true,
  },
  {
    id: "planning-kickoff",
    name: "Planning kickoff",
    stage: "planning",
    subject: "Planning your {{serviceNoun}}",
    body: `Hi {{firstName}},

Your {{serviceNoun}} is getting close, so it's time to plan.

When you have a few minutes, please fill out the planning questionnaire. It's already filled in with what I have: {{questionnaireUrl}}

It covers your timeline, the shots you care about most, the key people, and any details you want me to catch. Your portal is here too: {{portalUrl}}

Once it's in, pick a time for a call to plan the day: {{planningCallUrl}}

Julian`,
    advancesTo: "planning",
    followUp: { days: 7, note: "Check the questionnaire came back" },
  },
  {
    id: "questionnaire-reminder",
    name: "Questionnaire reminder",
    stage: "planning",
    subject: "Your planning questionnaire",
    body: `Hi {{firstName}},

When you have a few minutes, finishing the planning questionnaire helps me arrive prepared for your {{serviceNoun}}. It's already filled in with what I have: {{questionnaireUrl}}

It covers your timeline, the shots you care about most, the key people, and any details you want me to catch. Your portal is here too: {{portalUrl}}

Once it's in, pick a time for a call to plan the day: {{planningCallUrl}}

Reply with any questions.

Julian`,
    followUp: { days: 5, note: "Check the questionnaire came back" },
  },
  {
    id: "timeline-details",
    name: "Timeline & final details",
    stage: "scheduled",
    subject: "Your photography timeline for {{eventDate}}",
    body: `Hi {{firstName}},

Here's the photography timeline for {{eventDate}}, based on everything we've talked through: {{timelineUrl}}

Tell me if anything looks off. A few things I still need to confirm:
- [detail]
- [detail]

Once it's settled, share it with your other vendors so everyone works from the same plan. If it's easier to go through it together, pick a time here: {{planningCallUrl}}

{{questionnaireNudge}}

Julian`,
    advancesTo: "scheduled",
  },
  {
    id: "week-of",
    name: "Week-of / final details",
    stage: "scheduled",
    subject: "Final details for {{eventDate}}",
    body: `Hi {{firstName}},

Your day is almost here. A few final notes:

- Start time and first location: [details]
- Anything you should know: [details]
- Weather backup: [plan]

If anything has changed, reply and let me know. Otherwise, enjoy the day and leave the photos to me.

{{questionnaireNudge}}

See you soon,
Julian`,
    advancesTo: "scheduled",
  },
  {
    id: "post-shoot-thank-you",
    name: "Post-shoot thank-you",
    stage: "shot",
    subject: "Thank you, {{firstName}}",
    body: `Hi {{firstName}},

Thank you for having me. [A specific favorite moment from the day.]

Your photos are in editing now. Expect [a sneak peek within X days / the full gallery in X weeks]. I'll keep you posted, and everything will arrive in your portal: {{portalUrl}}

Julian`,
    advancesTo: "editing",
  },
  {
    id: "sneak-peek",
    name: "Sneak peek",
    stage: "editing",
    subject: "A first look at your {{serviceNoun}} photos",
    body: `Hi {{firstName}},

Here are a few favorites from your {{serviceNoun}} while I finish editing the rest: {{highlightsUrl}}

The full gallery is on its way. [Optional: feel free to share these, and tag me if you post them.]

Julian`,
    advancesTo: "editing",
  },
  {
    id: "gallery-delivery",
    name: "Gallery delivery",
    stage: "delivered",
    subject: "Your {{projectName}} gallery is ready",
    body: `Hi {{firstName}},

Your {{projectName}} gallery is ready. View, download and share your photos here: {{galleryUrl}}

[A favorite moment or two from the day.]

If you'd like prints or an album, reply and I'll help. And if you have a minute to leave a review, it makes a real difference to a small business like mine: {{reviewUrl}}

Thank you,
Julian`,
    advancesTo: "delivered",
  },
  {
    id: "prints-albums",
    name: "Prints & albums",
    stage: "delivered",
    subject: "Prints and albums from your gallery",
    body: `Hi {{firstName}},

If you'd like some of these photos on paper, I can help with prints, wall art or an album.

[A line about your album and print options, with starting prices.]

Fine-art prints can be ordered straight from your gallery: {{galleryUrl}}
For a custom album, reply and I'll walk you through it.

Julian`,
  },
  {
    id: "review-request",
    name: "Review request",
    stage: "complete",
    subject: "Would you leave a review?",
    body: `Hi {{firstName}},

I really enjoyed photographing your {{serviceNoun}}.

If you have a couple of minutes, would you leave a short review? Most of my clients find me through people like you, and a review helps them decide: {{reviewUrl}}

Thank you,
Julian`,
    advancesTo: "complete",
    followUp: { monthsAfterEvent: 11, note: "Anniversary email" },
  },
  {
    id: "referral-ask",
    name: "Referral ask",
    stage: "complete",
    subject: "Know someone with a date coming up?",
    body: `Hi {{firstName}},

I enjoyed working with you on {{projectName}}. If a friend or family member has something coming up, I'd be grateful if you passed my name along. Most of my work comes from past clients.

[Optional: as a thank-you, I can offer you and them (incentive).]

Thanks either way,
Julian`,
  },
  {
    id: "anniversary",
    name: "Anniversary / re-engagement",
    stage: "complete",
    subject: "Happy anniversary, {{firstName}}",
    body: `Hi {{firstName}},

Happy anniversary. I was thinking back to {{projectName}}: [a memory from the day]. I hope the year has been good to you.

If you'd like new portraits, an anniversary session or family photos, I'd be glad to photograph you again. You can start here whenever you're ready: {{bookingUrl}}

All the best,
Julian`,
  },
  {
    id: "re-engagement",
    name: "Re-engagement (cooled lead)",
    stage: "lost",
    subject: "Checking in about your {{serviceNoun}}",
    body: `Hi {{firstName}},

I wanted to check in about your {{serviceNoun}}. If you're still looking for a photographer, I'd like to help. If your plans have changed, no problem at all.

[Optional: a line picking up where we left off.]

If now's a good time, reply here or book a call: {{discoveryCallUrl}}

Julian`,
    followUp: { days: 7, note: "Last check-in, then close the lead" },
  },
  {
    id: "booked-elsewhere",
    name: "Booked elsewhere (graceful goodbye)",
    stage: "declined",
    subject: "Thanks for considering me",
    body: `Hi {{firstName}},

Thank you for considering me for your {{serviceNoun}}. I understand you've chosen another photographer, and I hope the day and the lead-up to it go well.

If anything changes, or you'd like photos later on (engagement, family, an anniversary), you're welcome to come back any time. And if you ever need a recommendation, I'm glad to point you to someone good.

All the best,
Julian`,
    closesAs: "declined",
  },
];

// Substitute `{{token}}` with a value from the context. A line holding only
// an optional token with no value is left out, with the blank line around it;
// any other token without a value is left as a visible `[token]` so Julian
// fills it in.
export function fillTemplate(
  text: string,
  ctx: Record<string, string | undefined>,
): string {
  const optional = new Set<string>(OPTIONAL_TOKENS);
  const kept = text
    .split("\n")
    .filter((line) => {
      const only = line.trim().match(/^\{\{(\w+)\}\}$/)?.[1];
      return !(only && optional.has(only) && !ctx[only]?.trim());
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return kept.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = ctx[key];
    return v && v.trim() ? v : `[${key}]`;
  });
}

// What's still in brackets in an email: an unfilled token, a template's prompt
// ("[2 or 3 of their priorities]"), a placeholder the AI left, or a link
// written as "[text](url)". Compose won't send while any remain.
export function unfilledParts(text: string): string[] {
  return [...new Set(text.match(/\[[^\[\]\n]{1,200}\]/g) ?? [])];
}

// Consecutive same-stage templates grouped together, so the compose picker
// reads in pipeline order.
export const GROUPED_TEMPLATES: { stage: string; items: EmailTemplate[] }[] = (() => {
  const groups: { stage: string; items: EmailTemplate[] }[] = [];
  for (const t of EMAIL_TEMPLATES) {
    const last = groups[groups.length - 1];
    if (last && last.stage === t.stage) last.items.push(t);
    else groups.push({ stage: t.stage, items: [t] });
  }
  return groups;
})();
