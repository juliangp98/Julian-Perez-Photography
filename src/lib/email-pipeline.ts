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
    subject: "Thanks for reaching out, {{firstName}}!",
    body: `Hi {{firstName}},

Thank you so much for reaching out about your {{serviceNoun}} — congratulations, and I'd love to be part of it!

[A line or two responding to something specific they shared.]

The best next step is a quick call so I can hear all about your vision and answer any questions. Are you free for a 15–20 minute chat this week? You can grab a time here: {{bookingUrl}}

Looking forward to connecting,
Julian`,
  },
  {
    id: "not-available",
    name: "Not available (offer alternatives)",
    stage: "new-inquiry",
    subject: "About your {{serviceNoun}} date",
    body: `Hi {{firstName}},

Thank you so much for thinking of me for your {{serviceNoun}} — it genuinely means a lot. I hate to say it, but I'm already booked on {{eventDate}} and won't be able to photograph your day.

[Optional: I'd be glad to recommend a couple of photographers I trust for your date — just say the word and I'll send their info.]

If your plans ever shift, please do reach out — I'd love the chance to work together down the road.

Wishing you all the best,
Julian`,
  },
  {
    id: "discovery-invite",
    name: "Discovery-call invite",
    stage: "responded",
    subject: "Let's find a time to chat, {{firstName}}",
    body: `Hi {{firstName}},

I'd love to hear more about your {{serviceNoun}} and how I can help tell your story. The easiest next step is a quick call — 15–20 minutes — so I can answer your questions and get a feel for what you're picturing.

Grab whatever time works best for you here: {{bookingUrl}}

If none of those slots fit, just reply with a couple of times that suit you and I'll make it work.

Talk soon,
Julian`,
  },
  {
    id: "discovery-recap",
    name: "Discovery-call recap",
    stage: "in-conversation",
    subject: "So great talking, {{firstName}} — next steps",
    body: `Hi {{firstName}},

It was so good to connect today — thank you for sharing your vision for {{projectName}}.

From everything you described — [recap 2–3 of their priorities] — I really think we'd be a great fit, and I'd be honored to be the one to capture it.

I've attached a proposal with the collection I'd recommend, plus a gallery so you can see how I'd tell your story. Your date is open and I'm happy to hold it for you for [X days] while you decide.

Any questions at all, just reply — I'm glad to hop back on a call too.

Julian`,
  },
  {
    id: "proposal",
    name: "Proposal / collections",
    stage: "proposal-sent",
    subject: "Your proposal — {{projectName}}",
    body: `Hi {{firstName}},

As promised, here's everything for {{projectName}} on {{eventDate}}.

Based on what you're after, I'd recommend [collection], which includes [coverage hours · number of images · etc.]. The full proposal is attached, along with a gallery so you can picture the day.

To book, it's a signed agreement + [X]% retainer. Your date is open and I can hold it for [X days].

Reply with any questions, or we can hop on a quick call anytime.

Julian`,
  },
  {
    id: "hold-the-date",
    name: "Hold-the-date",
    stage: "proposal-sent",
    subject: "Holding {{eventDate}} for you",
    body: `Hi {{firstName}},

Just a quick note — I'm holding {{eventDate}} for you for the next [X days], no obligation, while you look everything over.

After that I'll need to open the date back up, so if you're ready to lock it in, a signed agreement + [X]% retainer secures it. Happy to answer anything in the meantime.

Julian`,
  },
  {
    id: "proposal-follow-up",
    name: "Proposal follow-up",
    stage: "proposal-sent",
    subject: "Following up on your proposal, {{firstName}}",
    body: `Hi {{firstName}},

Just floating back to the top of your inbox — I wanted to make sure my proposal for {{projectName}} reached you, and to see if any questions have come up since.

No pressure at all; I know there's a lot that goes into choosing your photographer. If it'd help to talk anything through — collections, coverage, the timeline — I'm happy to hop on a quick call.

[Optional: your date is still open as of today, but I've had some interest in it, so I wanted to keep you in the loop.]

Warmly,
Julian`,
  },
  {
    id: "booking-welcome",
    name: "Booking welcome",
    stage: "booked",
    subject: "You're booked! Welcome, {{firstName}}",
    body: `Hi {{firstName}},

It's official — I'm so excited to be photographing {{projectName}}! Thank you for trusting me with your day.

Here's what's next:
- I've set up your private client portal — sign in anytime to see your status, dates, documents, and to add details: {{portalUrl}}
- As we get closer, I'll send a planning questionnaire so I show up fully prepared.

For now, just enjoy the moment — I've got you. Reply anytime with questions.

Julian`,
  },
  {
    id: "contract-deposit",
    name: "Contract & deposit",
    stage: "contract-signed",
    subject: "Let's make it official — {{projectName}}",
    body: `Hi {{firstName}},

I'm so glad we're moving forward! Two quick things lock in your date:

1. Sign the agreement: [contract link]
2. Submit the retainer of [amount]: [payment link]

Once both are in, your date is officially reserved and we can dive into the fun part — planning. Everything will live in your client portal as we go: {{portalUrl}}

Let me know if any questions come up. Can't wait!

Julian`,
  },
  {
    id: "payment-reminder",
    name: "Payment reminder",
    stage: "contract-signed",
    subject: "A friendly reminder — {{projectName}}",
    body: `Hi {{firstName}},

Just a gentle heads-up that your [deposit / balance] of [amount] for {{projectName}} is due on [date].

You can take care of it here whenever it's convenient: [payment link]

If you have any questions about your invoice, or need anything at all, just reply — I'm happy to help.

Thank you!
Julian`,
  },
  {
    id: "planning-kickoff",
    name: "Planning kickoff",
    stage: "planning",
    subject: "Let's plan your {{serviceNoun}}, {{firstName}}",
    body: `Hi {{firstName}},

Your {{serviceNoun}} is getting close — time for the fun part: planning!

When you have a few minutes, fill out your planning questionnaire so I can show up fully prepared. It's prefilled with what I already have: {{questionnaireUrl}}

It covers your timeline, must-have shots, key people, and any details you want me to capture. You can always check your portal here too: {{portalUrl}}

Reply with any questions,
Julian`,
  },
  {
    id: "questionnaire-reminder",
    name: "Questionnaire reminder",
    stage: "planning",
    subject: "Quick nudge on your planning questionnaire",
    body: `Hi {{firstName}},

No rush at all, but whenever you have a few minutes, finishing your planning questionnaire really helps me show up fully prepared for your {{serviceNoun}}. It's already prefilled with what I have: {{questionnaireUrl}}

It covers your timeline, the must-have shots, key people, and any details you want me to capture. You can always peek at your portal too: {{portalUrl}}

Reply with any questions — I'm here.

Julian`,
  },
  {
    id: "timeline-details",
    name: "Timeline & final details",
    stage: "scheduled",
    subject: "Your day-of timeline, {{firstName}}",
    body: `Hi {{firstName}},

I've put together a photography timeline for {{eventDate}} based on everything we've talked through. Take a look and tell me if anything looks off:

[Paste or attach the timeline — e.g. getting ready, first look, ceremony, portraits, reception highlights.]

A few things I'd still love to confirm:
- [detail]
- [detail]

Once we're aligned on this, you can share it with your other vendors so we're all on the same page. Getting excited!

Julian`,
  },
  {
    id: "week-of",
    name: "Week-of / final details",
    stage: "scheduled",
    subject: "Almost here! Final details for {{eventDate}}",
    body: `Hi {{firstName}},

Your day is almost here and I can't wait! A few final notes:

- Start time / first location: [details]
- Anything you should know: [details]
- Weather backup: [plan]

If anything's changed, just reply and let me know. Otherwise — relax, soak it in, and leave the photos to me. See you soon!

Julian`,
  },
  {
    id: "post-shoot-thank-you",
    name: "Post-shoot thank-you",
    stage: "shot",
    subject: "Thank you for an incredible day, {{firstName}}!",
    body: `Hi {{firstName}},

What a day — thank you for letting me be part of it. [A specific favorite moment from the day.]

Here's what's next: your photos are now in editing. You can expect [a sneak peek within X days / your full gallery in X weeks]. I'll keep you posted, and everything will land in your portal: {{portalUrl}}

Thank you again — I can't wait for you to see these.

Julian`,
  },
  {
    id: "sneak-peek",
    name: "Sneak peek",
    stage: "editing",
    subject: "A little sneak peek of your {{serviceNoun}}",
    body: `Hi {{firstName}},

I couldn't wait — here are a few favorites from your {{serviceNoun}} while I finish editing the rest:

[Attach 3–5 preview images, or paste a preview link.]

Your full gallery is on its way. [Optional: feel free to share these — just tag me so I can follow along!]

More soon,
Julian`,
  },
  {
    id: "gallery-delivery",
    name: "Gallery delivery",
    stage: "delivered",
    subject: "Your gallery is ready, {{firstName}}!",
    body: `Hi {{firstName}},

The moment you've been waiting for — your {{projectName}} gallery is ready!

View, download, and share your photos here: {{galleryUrl}}

[A favorite moment or two from the day.]

It was such an honor to capture your day. If you love the images, prints and albums are available — just reply and I'll help. And if you have a minute to leave a review, it means the world to a small business like mine.

With gratitude,
Julian`,
  },
  {
    id: "prints-albums",
    name: "Prints & albums",
    stage: "delivered",
    subject: "Bring your photos to life — prints & albums",
    body: `Hi {{firstName}},

I hope you're loving your gallery! If you'd like to hold these memories in your hands, I'd be glad to help with prints, wall art, or a heirloom album.

[A line about your album / print options and any starting prices.]

You can order fine-art prints right from your gallery: {{galleryUrl}}
For a custom album, just reply and I'll walk you through it.

With gratitude,
Julian`,
  },
  {
    id: "review-request",
    name: "Review request",
    stage: "complete",
    subject: "Thank you, {{firstName}} — a small favor?",
    body: `Hi {{firstName}},

I hope you're still floating from your {{serviceNoun}}! It was genuinely a joy to be part of it.

If you have a couple of minutes, would you mind leaving a quick review? Word of mouth means everything for a small business, and it helps others find me: [review link]

Thank you again for trusting me with your story.

Julian`,
  },
  {
    id: "referral-ask",
    name: "Referral ask",
    stage: "complete",
    subject: "Know someone I could help, {{firstName}}?",
    body: `Hi {{firstName}},

It was such a joy working with you on {{projectName}}. If you have friends or family with something special coming up, I'd be so grateful if you sent them my way — referrals from past clients are the heart of my little business.

[Optional: as a thank-you, I'd love to offer you (and them) (incentive).]

Either way, thank you for trusting me with your story.

Julian`,
  },
  {
    id: "anniversary",
    name: "Anniversary / re-engagement",
    stage: "complete",
    subject: "Happy anniversary, {{firstName}}!",
    body: `Hi {{firstName}},

Happy anniversary! I was just thinking back to {{projectName}} — [a warm memory from the day]. I hope this year has been good to you.

If you've been thinking about updated portraits — an anniversary session, or family photos as things grow and change — I'd love to be behind the camera again. Here's where to start whenever you're ready: {{bookingUrl}}

Wishing you the very best,
Julian`,
  },
  {
    id: "re-engagement",
    name: "Re-engagement (cooled lead)",
    stage: "lost",
    subject: "Still here whenever you're ready, {{firstName}}",
    body: `Hi {{firstName}},

I know life gets busy, so I wanted to gently check back in about your {{serviceNoun}}. If you're still looking for a photographer, I'd genuinely love to help — and if your plans have changed, no worries at all.

[Optional: a line picking up from where we last left off.]

If now's a good time to pick things back up, just reply or grab a call here: {{bookingUrl}}

Either way, I'm wishing you well,
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
