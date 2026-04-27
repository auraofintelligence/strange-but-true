# Meta, Pixel, Store And Checkout Setup

This is a practical proposal for connecting the Strange but True site to Meta Business Suite, Meta Pixel, social sharing and a small direct checkout store.

## Recommended Checkout Stack

Start simple:

1. **Stripe Payment Links** for direct card, Apple Pay and Google Pay style checkout.
2. **PayPal** as a secondary payment option if customers ask for it.
3. **Manual crypto verification** only after the real XRP, SOL and iCi-on-SOL wallet addresses are confirmed.

Why Stripe first:

- Mobile checkout is clean.
- No full ecommerce platform is needed at launch.
- Each product can have its own payment link.
- Stripe can redirect back to `thank-you.html` after payment.
- Meta Pixel events can later track product button clicks and thank-you page visits.

## Product Links To Create

Create one payment link per launch product:

- Start Here Sampler: free delivery or mailing-list link.
- Single I C. Infinity album: `$20`.
- Two Album Bundle: `$35`.
- Full Discography Pack: `$70`.
- Written Worlds Bundle: `$50`.
- Written Worlds Plus: `$75`.
- Strange but True Supporter Bundle: `$100`.
- Supporter Plus / Super Bonus: nominated higher invoice by arrangement.

Replace the `example.com/replace-with-stripe-payment-link...` placeholders in `downloads.html` after links exist.

## Delivery Setup

Early options:

- Stripe success page redirects to `thank-you.html`.
- The thank-you page explains that delivery is by email while the catalogue is being set up.
- Later, replace that with secure download links or an automated delivery service.

Minimum before launch:

- Product file names and formats.
- Refund policy.
- Delivery timing.
- Support contact.
- Test purchase.

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

Launch products:

- Start Here Sampler.
- Single I C. Infinity album.
- Two Album Bundle.
- Full Discography Pack.
- Written Worlds Bundle.
- Written Worlds Plus.
- Strange but True Supporter Bundle.
- Supporter Plus / Super Bonus.

## Social Sharing

The site currently includes:

- Web Share API button for phones.
- Facebook share link.
- X share link.
- WhatsApp share link.
- Messenger send link with `FACEBOOK_APP_ID_PLACEHOLDER`.
- Instagram caption/share-copy button.
- TikTok caption/share-copy button.

Before launch:

- Replace `https://example.com/replace-with-github-pages-url/` with the live GitHub Pages URL.
- Replace `FACEBOOK_APP_ID_PLACEHOLDER` if Messenger dialog sharing is kept.
- Consider using regular Messenger/WhatsApp contact buttons instead of app-based Messenger sharing if that is simpler.
- Replace footer placeholder social profile URLs:
  - `https://www.facebook.com/PLACEHOLDER_STRANGE_BUT_TRUE`
  - `https://x.com/PLACEHOLDER_STRANGE_BUT_TRUE`
  - `https://www.instagram.com/PLACEHOLDER_STRANGE_BUT_TRUE`
  - `https://www.tiktok.com/@PLACEHOLDER_STRANGE_BUT_TRUE`

Note: Instagram and TikTok do not provide simple reliable web share URLs for ordinary website links in the same way Facebook, X and WhatsApp do. The current buttons use the phone-native share sheet or copyable caption text, which is usually the cleaner path.

## Link Behaviour

- Internal site links stay in the same tab.
- External profile, streaming, sample and social links open in a new tab with `rel="noopener noreferrer"`.
- Subpages include a small Back/Home strip. The Back button uses browser history when available and falls back to `index.html`.

## Google Apps Script Forms API

Use one Google Apps Script Web App endpoint for the public forms. Replace `GOOGLE_APPS_SCRIPT_WEB_APP_URL_PLACEHOLDER` in the HTML files after deployment.

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

## AI Guide

The contact page now points to `ai-guide.html`, which is the public planning and configuration source for the future Strange but True guide.

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
