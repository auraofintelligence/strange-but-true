# Meta, Pixel, Store And Checkout Setup

This is a practical proposal for connecting the Strange but True site to Meta Business Suite, Meta Pixel, social sharing and a small direct checkout store.

## Digital Music Checkout

The Downloads page offers Stripe and PayPal for digital album orders. Its public configuration remains disabled until the dedicated Apps Script deployment and both payment accounts are configured and tested.

- Any one completed album: `$20 AUD`.
- Any two completed albums: `$35 AUD`.
- Any three completed albums: `$45 AUD`.
- All four completed albums: `$55 AUD`.

A Protopian Gambit is included in the same deals as Songs of Straddie, Chronicles of the Forgotten and Starseed Code. Straddie Fun remains in progress.

`downloads.js` updates the displayed total as albums are checked. The server independently validates the four album IDs and calculates the amount. Buyer-supplied prices are not used.

Setup and tests: see `tools/checkout/README.md`. The code continues the Music Universe Apps Script checkout approach, with actual Stripe Checkout Sessions and PayPal Orders integration. Payment credentials belong only in private Script Properties. `checkout-config.js` contains only the public web-app endpoint.

## Delivery Setup

- Order details are recorded in a private Google Sheet.
- A provider response is verified before an order is marked paid.
- Luke receives a notification for verified paid orders and delivers the agreed files manually.
- Returning to a confirmation URL by itself does not prove payment.
- USB, CD and DVD orders remain separately arranged until their media and delivery charges are set.
- Writing and data packages are not part of this fixed-price music checkout.

Before accepting public payments, complete a sandbox test for each provider and confirm the delivery process. The frontend remains disabled when its endpoint is missing.

## Meta Business Suite

Set up:

1. Create or connect the Facebook Page.
2. Create Meta Business Portfolio for Strange but True.
3. Add Instagram later if needed.
4. Add WhatsApp Business if it becomes the preferred quick-contact channel.
5. Add the site URL after GitHub Pages is live.

Useful Meta assets:

- Facebook Page.
- Meta Pixel dataset.
- Commerce catalogue.
- WhatsApp contact button.
- Messenger contact option.

## Meta Pixel

Recommended events:

- `PageView` on all pages.
- `ViewContent` on `downloads.html`.
- `InitiateCheckout` when a product checkout popup opens.
- `Purchase` only on a confirmed payment success page, not on the current placeholder thank-you page.
- `Lead` on contact or referral actions.

Do not add a real Pixel ID until the domain and Meta account are ready.

Placeholder implementation later:

```html
<!-- Replace META_PIXEL_ID_PLACEHOLDER before launch -->
```

## Meta Store / Commerce Catalogue

Use Meta Store as a discovery layer, not the only checkout.

Suggested setup:

- Add products to Meta Commerce Manager.
- Use product links pointing back to the direct website checkout or Stripe Payment Links.
- Keep product names identical across website, Meta and posts.

Launch products should match the current digital album deals above. Do not publish retired writing/supporter tiers or unfinished data packages as checkout products.

## Social Sharing

The site currently includes:

- Web Share API button for phones.
- Facebook, X and WhatsApp share links.
- Instagram and TikTok caption/share-copy buttons.

Before launch:

- Add further social profiles only when their correct addresses are known.

Note: Instagram and TikTok do not provide simple reliable web share URLs for ordinary website links in the same way Facebook, X and WhatsApp do. The current buttons use the phone-native share sheet or copyable caption text, which is usually the cleaner path.

## Link Behaviour

- Internal site links stay in the same tab.
- External profile, streaming, sample and social links open in a new tab with `rel="noopener noreferrer"`.
- Subpages include a small Back/Home strip. The Back button uses browser history when available and falls back to `index.html`.

## Google Apps Script Forms API

Use one Google Apps Script Web App endpoint for the public forms. Current endpoint:

`https://script.google.com/macros/s/AKfycbyhKWOuIHgi5LVLniO-_ZnMp0ITOufBBPR94PMImQXTt7GRu7Wt_hiHnk_gJJdDg-m_/exec`

Current setup:

- `contact.html` and `feedback.html` post to the Google Apps Script web app endpoint above.
- `contact-apps-script.gs` is a starter script for a Google Sheet-bound Apps Script web app. It writes form rows to the tabs below and emails notifications to `sbt4183@gmail.com`.
- Do not use `mailto:` form handling for the public forms. It depends on the visitor's email app and is too brittle for public submissions.

Form types:

- `enquiry`: general contact form on `contact.html`.
- `meeting_request`: meeting request form on `contact.html`.
- `feedback`: friendly feedback form on `feedback.html`.

Suggested Google Sheet tabs:

- `Enquiries`
- `Meeting Requests`
- `Feedback`

Apps Script responsibilities:

- Validate required fields.
- Reject or flag submissions where the hidden `website` honeypot field is filled.
- Reject oversized message bodies.
- Write each submission to the matching Sheet tab.
- Email relevant notifications to `sbt4183@gmail.com`.
- Include enough meeting-request details in the notification email for Luke to manually confirm and create a Google Calendar event.

Calendar handling v1:

- Do not create confirmed Google Calendar events automatically.
- Treat meeting form submissions as requests only.
- If Calendar automation is added later, create tentative/requested events only after private review or via a private admin action.

Drive/workspace:

- Use `auraofintelligence@gmail.com` Drive / AI Pro workspace for product files, working documents and internal materials where appropriate.

## Later AI Guide

The AI guide is parked for later. Keep public contact paths focused on the normal enquiry, meeting request and feedback forms for now.

Best v1:

- Start with a small text guide that answers from approved website copy.
- Use it for service triage, download/catalogue explanation, meeting prep and form handoff.
- Keep it opt-in and clearly labelled as AI.
- Do not make it a private support channel.

Approved knowledge sources:

- Public site pages.
- Service menu and market notes.
- Download catalogue and sample descriptions.
- Privacy, terms and checkout notes.
- Short tone examples written by Luke.

Connector and API options:

- Google Apps Script for form submission handling.
- Google Sheets for enquiries, meeting requests, feedback and later AI handoff notes.
- Google Calendar for manual meeting confirmation first; tentative automation later if needed.
- Google Drive for approved knowledge files, product files and operating notes.
- OpenAI API or another agent platform for plain-language triage.
- ElevenLabs or browser speech for optional voice after the text guide works.
- HeyGen only if an avatar/video layer genuinely improves clarity and trust.

Rules before launch:

- Label it clearly as AI.
- Keep it opt-in, not auto-playing.
- Do not ask for passwords, private keys, recovery phrases, health/financial documents, private device contents, payment card details or one-time codes.
- Always offer the normal contact form, meeting request form or feedback form as a fallback.
- Add privacy wording before embedding any third-party agent.
- Treat uncertain or personal requests as handoffs to Luke, not as answers to improvise.
