// Pipeline email templates — starting drafts Julian picks, fills, edits, and
// sends from a project. Pure + dependency-free (importable client-side by the
// compose UI). `{{token}}` placeholders are auto-filled from the project; tokens
// without a value (and free-form `[bracket]` prompts) are left visible so Julian
// notices what to complete before sending.

export type EmailTemplate = {
  id: string;
  name: string;
  // A pipeline stage the template best fits — used only to order the picker.
  stage: string;
  subject: string;
  body: string;
};

// The core set, ordered along the communication pipeline.
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
