# QA Notes

## Completed Static Checks

- Local HTML links and anchors checked: no missing local paths or missing anchors.
- Product checkout buttons are wired to the checkout modal.
- Post-payment path exists: `thank-you.html`.
- Referral path exists: `refer.html`.
- Feedback path exists: `feedback.html`.
- Contact page has enquiry and meeting request form sections.
- AI guide path exists: `ai-guide.html`, with service triage, safe-answer boundaries, connector options and form handoff guidance.
- Privacy and terms pages exist and are linked in the footer and checkout modal.
- Optimized WebP assets created and wired into the main image placements.
- Apps Script endpoint placeholder remains until deployment.

## Browser QA Status

Attempted Browser Use visual QA on the local site, but the Node/browser runtime returned `Access is denied` before opening the page. The site remains directly openable in Chrome from `C:\Users\lukec\Documents\SBT_GitHubSite\downloads.html`.

Manual checks recommended in Chrome:

- Open `index.html`, `contact.html`, `ai-guide.html`, `feedback.html`, `downloads.html`, `thank-you.html`, `refer.html`, `privacy.html`, and `terms.html`.
- On `downloads.html`, tap each product button and confirm the checkout popup opens with the right product name and price.
- Check the popup on mobile width: wallet fields should not overflow.
- Check footer wrapping on mobile width.
- Check YouTube embed behaviour after publishing to GitHub Pages; local `file://` pages may show YouTube Error 153.
