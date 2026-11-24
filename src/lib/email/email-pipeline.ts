// Pipeline email templates — starting drafts Julian picks, fills, edits, and
// sends from a project. Pure + dependency-free (importable client-side by the
// compose UI). `{{token}}` placeholders are auto-filled from the project; tokens
// without a value (and free-form `[bracket]` prompts) are left visible so Julian
// notices what to complete before sending.

export type EmailTemplate = {
  id: string;
  name: string;
  // A pipeline stage the template best fits — used to order + group the picker.
  // Values mirror the canonical client statuses in `client-status.ts`.
  stage: string;
  subject: string;
  body: string;
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

Thanks for getting in touch about your {{serviceNoun}}, and congratulations.

[A line or two answering something specific they shared.]

The easiest next step is a short call, 15 to 20 minutes, so I can hear what you have in mind and answer your questions. You can pick a time here: {{bookingUrl}}

Talk soon,
Julian`,
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
  },
  {
    id: "discovery-invite",
    name: "Discovery-call invite",
    stage: "responded",
    subject: "A quick call about your {{serviceNoun}}",
    body: `Hi {{firstName}},

I'd like to hear more about your {{serviceNoun}}. A 15 to 20 minute call is the easiest way for me to answer your questions and get a sense of what you're picturing.

Pick any time that works here: {{bookingUrl}}

If none of those fit, reply with a couple of times that suit you and I'll make one work.

Julian`,
  },
  {
    id: "discovery-recap",
    name: "Discovery-call recap",
    stage: "in-conversation",
    subject: "Next steps for {{projectName}}",
    body: `Hi {{firstName}},

Thanks for the call today and for walking me through {{projectName}}.

You mentioned [2 or 3 of their priorities]. That's the kind of day I photograph best, and I'd like to be there for it.

I've attached a proposal with the collection I'd recommend, and a gallery so you can see how I work. Your date is open, and I can hold it for [X days] while you decide.

If anything's unclear, reply here or we can talk again.

Julian`,
  },
  {
    id: "proposal",
    name: "Proposal / collections",
    stage: "proposal-sent",
    subject: "Your proposal for {{projectName}}",
    body: `Hi {{firstName}},

As promised, here's the proposal for {{projectName}} on {{eventDate}}.

For what you described, I'd recommend [collection]: [coverage hours, number of images, and so on]. The full proposal is attached, with a gallery so you can picture the day.

Booking is a signed agreement and a [X]% retainer. Your date is open, and I can hold it for [X days].

Reply with any questions, or we can set up a call.

Julian`,
  },
  {
    id: "hold-the-date",
    name: "Hold-the-date",
    stage: "proposal-sent",
    subject: "Holding {{eventDate}} for you",
    body: `Hi {{firstName}},

I'm holding {{eventDate}} for you for the next [X days], with no obligation, while you look everything over.

After that I'll need to open the date again. When you're ready, a signed agreement and a [X]% retainer secure it. Ask me anything in the meantime.

Julian`,
  },
  {
    id: "proposal-follow-up",
    name: "Proposal follow-up",
    stage: "proposal-sent",
    subject: "Following up on your proposal",
    body: `Hi {{firstName}},

I wanted to check that my proposal for {{projectName}} reached you, and see whether any questions have come up.

Choosing a photographer takes time, so there's no rush. If it would help to talk through collections, coverage or the timeline, I'm happy to get on a call.

[Optional: your date is still open as of today, but someone else has asked about it, so I wanted you to know.]

Julian`,
  },
  {
    id: "booking-welcome",
    name: "Booking welcome",
    stage: "booked",
    subject: "You're booked for {{eventDate}}",
    body: `Hi {{firstName}},

It's official: I'm photographing {{projectName}}. Thank you for choosing me.

What happens next:
- Your client portal is set up. Sign in any time to see your status, dates and documents, and to add details: {{portalUrl}}
- Closer to the date, I'll send a planning questionnaire so I arrive prepared.

Reply any time with questions.

Julian`,
  },
  {
    id: "contract-deposit",
    name: "Contract & deposit",
    stage: "contract-signed",
    subject: "Two steps to reserve {{eventDate}}",
    body: `Hi {{firstName}},

Two things reserve your date:

1. Sign the agreement: [contract link]
2. Pay the retainer of [amount]: [payment link]

Once both are in, the date is yours and we can start planning. Everything will be in your client portal as we go: {{portalUrl}}

Let me know if anything comes up.

Julian`,
  },
  {
    id: "payment-reminder",
    name: "Payment reminder",
    stage: "contract-signed",
    subject: "Payment due on [date] for {{projectName}}",
    body: `Hi {{firstName}},

A reminder that your [retainer / balance] of [amount] for {{projectName}} is due on [date].

You can pay here whenever it suits you: [payment link]

If you have questions about the invoice, just reply.

Thank you,
Julian`,
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

Julian`,
  },
  {
    id: "questionnaire-reminder",
    name: "Questionnaire reminder",
    stage: "planning",
    subject: "Your planning questionnaire",
    body: `Hi {{firstName}},

When you have a few minutes, finishing the planning questionnaire helps me arrive prepared for your {{serviceNoun}}. It's already filled in with what I have: {{questionnaireUrl}}

It covers your timeline, the shots you care about most, the key people, and any details you want me to catch. Your portal is here too: {{portalUrl}}

Reply with any questions.

Julian`,
  },
  {
    id: "timeline-details",
    name: "Timeline & final details",
    stage: "scheduled",
    subject: "Your photography timeline for {{eventDate}}",
    body: `Hi {{firstName}},

Here's the photography timeline for {{eventDate}}, based on everything we've talked through. Tell me if anything looks off:

[Paste or attach the timeline: getting ready, first look, ceremony, portraits, reception.]

A few things I still need to confirm:
- [detail]
- [detail]

Once it's settled, share it with your other vendors so everyone works from the same plan.

Julian`,
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

See you soon,
Julian`,
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
  },
  {
    id: "sneak-peek",
    name: "Sneak peek",
    stage: "editing",
    subject: "A first look at your {{serviceNoun}} photos",
    body: `Hi {{firstName}},

Here are a few favorites from your {{serviceNoun}} while I finish editing the rest:

[Attach 3 to 5 preview images, or paste a preview link.]

The full gallery is on its way. [Optional: feel free to share these, and tag me if you post them.]

Julian`,
  },
  {
    id: "gallery-delivery",
    name: "Gallery delivery",
    stage: "delivered",
    subject: "Your {{projectName}} gallery is ready",
    body: `Hi {{firstName}},

Your {{projectName}} gallery is ready. View, download and share your photos here: {{galleryUrl}}

[A favorite moment or two from the day.]

If you'd like prints or an album, reply and I'll help. And if you have a minute to leave a review, it makes a real difference to a small business like mine.

Thank you,
Julian`,
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

If you have a couple of minutes, would you leave a short review? Most of my clients find me through people like you, and a review helps them decide: [review link]

Thank you,
Julian`,
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

If now's a good time, reply here or book a call: {{bookingUrl}}

Julian`,
  },
  {
    id: "booked-elsewhere",
    name: "Booked elsewhere (graceful goodbye)",
    stage: "declined",
    subject: "Thanks for considering me",
    body: `Hi {{firstName}},

Thank you for considering me for your {{serviceNoun}}. I understand you've chosen another photographer, and I hope the day and the lead-up to it go well.

If anything changes, or you'd like photos later on (engagement, family, an anniversary), you're welcome to come back any time. And if you ever need a recommendation, I'm glad to point you to someone good.

Congratulations again,
Julian`,
  },
];

// Substitute `{{token}}` with a value from the context. Tokens without a
// non-empty value are left as a visible `[token]` so Julian fills them in.
export function fillTemplate(
  text: string,
  ctx: Record<string, string | undefined>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = ctx[key];
    return v && v.trim() ? v : `[${key}]`;
  });
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
