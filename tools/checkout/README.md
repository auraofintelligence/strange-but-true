# Digital album checkout

This is the server for Strange but True's four completed I C. Infinity albums. It supports Stripe-hosted card checkout and PayPal Orders v2. The browser shows the package price immediately; this server independently derives the charge from the selected album IDs.

| Completed albums selected | AUD charge |
| --- | ---: |
| Any one | $20 |
| Any two | $35 |
| Any three | $45 |
| All four | $55 |

Fixed-price checkout accepts **digital download** with `audio` or `audio-video` preferences. USB, CD/DVD, video-only selections, custom archives and unpublished packages stay outside these charges until their contents and costs are agreed. There is no automatic tax addition in this implementation.

## What the buyer does

1. Selects completed albums and reviews the price on the website.
2. Enters their name and delivery email and selects Stripe or PayPal.
3. Submits a normal HTML form to a dedicated Apps Script endpoint.
4. Continues to the payment provider's hosted page.
5. Returns to this endpoint. The server retrieves the payment from the provider; PayPal approvals are captured and then retrieved again.
6. Receives a confirmation page only after the server verifies the order, amount, AUD currency and completed payment.

The private order sheet and an owner notification support **manual digital fulfilment**. This implementation never unlocks files or treats a return URL, `success` query string, PayPal approval, or pending capture as payment proof. It does not collect card numbers.

## Server setup

Use a **dedicated Apps Script project** for this checkout. Do not replace the existing contact/feedback form script.

1. Create a private Google Sheet for orders. The script creates the `Checkout Orders` tab and exact headers when it first runs; it refuses to overwrite a different header layout.
2. In Apps Script, add [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Enable the manifest in project settings and copy [`appsscript.json`](google-apps-script/appsscript.json).
3. Add the following **Script Properties**. Never put credentials in frontend JavaScript, HTML, Git, screenshots, or chat messages.

| Script property | Value |
| --- | --- |
| `SPREADSHEET_ID` | ID of the private order spreadsheet. |
| `SHEET_NAME` | Optional; defaults to `Checkout Orders`. |
| `CHECKOUT_MODE` | `test` initially; `live` only after both providers have been tested. |
| `CHECKOUT_ENDPOINT_URL` | The final deployment URL: `https://script.google.com/macros/s/.../exec`, with no fragment or query string. |
| `CHECKOUT_TOKEN_SECRET` | A securely generated random secret, at least 32 random bytes encoded as 43+ base64url characters. Keep it stable while checkouts are active. |
| `OWNER_EMAIL` | Private recipient for verified-paid order notifications. |
| `STRIPE_SECRET_KEY` | Corresponding Stripe test or live secret/restricted key with permissions to create and retrieve Checkout Sessions. The key prefix must match `CHECKOUT_MODE`. |
| `STRIPE_API_VERSION` | Optional; pinned default is `2026-10-28.endive`, matching the official API reference checked on 2 November 2026. |
| `PAYPAL_CLIENT_ID` | PayPal REST app client ID for the selected environment. |
| `PAYPAL_CLIENT_SECRET` | Matching PayPal app secret. |
| `PAYPAL_MERCHANT_ID` | Optional additional expected-merchant check when reading PayPal purchase units. |

Generate the token secret using a password manager or a cryptographically secure local generator; for example `require('node:crypto').randomBytes(32).toString('base64url')`. Copy it directly into Script Properties rather than saving it to a repository file. This is a configuration instruction, not a credential included in this source.

4. Deploy a new **web app**, executing as the owner, with public access for buyers. Copy the resulting `/exec` URL into `CHECKOUT_ENDPOINT_URL`; redeploy after code changes. Authorise only the declared Sheets, external-request and email scopes.
5. Set the website's public checkout configuration to use this `/exec` URL. Public frontend configuration needs only the endpoint and whether checkout is enabled; it never needs provider secrets.
6. In Apps Script's Triggers panel, add a time-driven trigger for `reconcileCheckoutPayments` every ten minutes. This catches completed payments when a buyer closes the provider page without returning and retries failed owner notifications. Each run checks up to ten eligible records and rotates its starting point so old abandoned checkouts do not block newer orders.

For a standard HTML form, post a single value for each field:

| Form field | Contract |
| --- | --- |
| `albums` | Comma-separated unique IDs from `songs-of-straddie`, `chronicles-of-the-forgotten`, `starseed-code-from-aura-to-infinity`, `a-protopian-gambit`. |
| `paymentMethod` | `stripe` or `paypal`. |
| `buyerName` | Name, maximum 120 characters. |
| `buyerEmail` | Delivery email, maximum 254 characters. |
| `delivery` | `download`. |
| `filePreference` | `audio` or `audio-video`. |
| `requestId` | Stable UUID v4 for this exact order submission. Keep it for retries; generate a new one after changing albums, buyer details, provider or file preference. |
| `website` | Empty honeypot. |

Do not submit multiple named checkbox values: serialize selected album IDs into the single `albums` field. Browser prices, package IDs and return URLs are not trusted or used by the server.

## Payment verification and retries

- Stripe: creates a payment-mode Checkout Session in AUD. On reconciliation, matches the stored session ID, order reference, album metadata, exact total, currency and test/live environment; requires both `status=complete` and `payment_status=paid`.
- PayPal: creates an AUD order with `intent=CAPTURE`. Matches the stored PayPal order ID, custom/reference/invoice IDs and total; captures approved orders; retrieves them again and requires an exact completed final capture. A PayPal account/profile redirect is not used as a substitute for payment integration.
- A stable browser request UUID, a stored fingerprint, a script lock and provider idempotency headers prevent duplicate retries from creating independent charges. A changed payload with the same request ID is rejected.
- Capture uses a different stored idempotency UUID from order creation. Uncertain captures are retrieved before marking payment state.
- Only a hash of the per-order return-access token is stored in the order sheet. Tokenised callback pages have no third-party assets, use a no-referrer policy and expose no buyer name or email.
- Input lengths and album IDs are validated. Sheet text is escaped against formula interpretation. Provider response bodies and credentials are never written to the sheet or returned to buyers; only short internal error codes are recorded.
- Owner notification is best effort. Paid status is stored first, so notification failure cannot undo a verified payment. The time trigger retries it. A rare email service error after sending can still produce a duplicate notification; fulfil each order ID only once.
- Public form endpoints can receive spam; a honeypot is included, but this small-volume implementation is not an anti-fraud or high-volume storefront service. Monitor Apps Script/provider quotas and order records as sales grow.

This server uses verified polling and callbacks rather than provider webhooks. Keep the reconciliation trigger active. Manual delivery still requires checking the provider dashboard for refunds, disputes or later reversals. Do not add instant delivery based solely on the browser confirmation page.

## Validation before live use

Run the non-network tests from the repository root:

```text
node tools/checkout/test-checkout.cjs
```

Then use provider test accounts to exercise all four package prices, both providers, cancellation, provider refusal, repeated submits, browser back/reload, and a successful payment where the buyer never returns. Confirm the sheet and owner notification contain the correct albums, format preference, amount and payment reference. Confirm no notification is sent for unpaid/pending orders. Use separate test and live deployments/sheets where practical.

The mocked tests do not prove that an account, Apps Script deployment, credentials, live provider settings or actual file delivery works. A live configuration must only be described as working after those account-level checks succeed.

## Official implementation references

Checked 2 November 2026:

- [Stripe: create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe: retrieve Checkout Session](https://docs.stripe.com/api/checkout/sessions/retrieve)
- [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe: fulfil Checkout payments](https://docs.stripe.com/checkout/fulfillment)
- [PayPal: create order](https://developer.paypal.com/api/orders/v2/orders-create)
- [PayPal: retrieve order](https://developer.paypal.com/api/orders/v2/orders-get)
- [PayPal: capture order](https://developer.paypal.com/api/orders/v2/orders-capture)
- [PayPal: idempotency](https://developer.paypal.com/api/rest/reference/idempotency/)
