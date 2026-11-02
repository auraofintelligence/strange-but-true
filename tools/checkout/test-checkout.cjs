// Mocked Apps Script/provider tests. This file never calls a network or sends email.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'google-apps-script', 'Code.gs'), 'utf8');
const slugs = ['songs-of-straddie', 'chronicles-of-the-forgotten', 'starseed-code-from-aura-to-infinity', 'a-protopian-gambit'];
const requestId = '2a57cb24-4316-4c10-bbc5-e35df5022491';

function environment() {
  const rows = [];
  const calls = [];
  const emails = [];
  let responder = () => { throw new Error('Unexpected provider call'); };
  const properties = {
    SPREADSHEET_ID: 'mock-private-sheet', CHECKOUT_MODE: 'test', CHECKOUT_TOKEN_SECRET: 'test-only-'.repeat(8),
    CHECKOUT_ENDPOINT_URL: 'https://script.google.com/macros/s/mock-exec-id/exec', OWNER_EMAIL: 'owner@example.test',
    STRIPE_SECRET_KEY: 'sk_test_not_a_real_key', PAYPAL_CLIENT_ID: 'mock-client', PAYPAL_CLIENT_SECRET: 'mock-secret',
  };
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
    setFrozenRows: () => {},
    appendRow: row => { rows.push([...row]); },
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => rows[row - 1 + r]?.[column - 1 + c] ?? '')),
        setValues(values) {
          values.forEach((valuesRow, r) => valuesRow.forEach((value, c) => {
            rows[row - 1 + r] ||= [];
            rows[row - 1 + r][column - 1 + c] = value;
          }));
        },
        setValue(value) { rows[row - 1] ||= []; rows[row - 1][column - 1] = value; },
      };
    },
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null, setProperty: (key, value) => { properties[key] = value; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }), flush: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()],
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', key).update(value).digest()],
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
      base64Encode: value => Buffer.from(value).toString('base64'), sleep: () => {},
    },
    HtmlService: { createHtmlOutput: html => html },
    MailApp: { sendEmail: mail => emails.push(mail) },
    UrlFetchApp: { fetch: (url, options) => {
      calls.push({ url, options: JSON.parse(JSON.stringify(options)) });
      const value = responder(url, options);
      return { getResponseCode: () => value.status ?? 200, getContentText: () => JSON.stringify(value.body) };
    } },
  });
  vm.runInContext(source, context);
  return { context, rows, calls, emails, properties, sheet, respond: fn => { responder = fn; } };
}

function input(overrides = {}) {
  return { albums: slugs.join(','), paymentMethod: 'stripe', buyerName: 'Listener', buyerEmail: 'listener@example.test',
    delivery: 'download', filePreference: 'audio-video', requestId, ...overrides };
}
function post(env, data = input()) { return env.context.doPost({ parameter: data }); }
function stripeSession(env, options = {}) {
  const order = env.context.checkoutOrders_(env.sheet)[0];
  return { id: 'cs_test_MOCKSESSION', mode: 'payment', amount_total: Number(order.amountCents), currency: 'aud',
    status: 'complete', payment_status: 'paid', livemode: false, client_reference_id: order.orderId,
    metadata: { order_id: order.orderId, album_ids: order.albums }, payment_intent: 'pi_MOCK', ...options };
}
function stripeCreate(env, url, options) {
  const order = env.context.checkoutOrders_(env.sheet)[0];
  assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
  return { body: { ...stripeSession(env), status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/c/pay/mock' } };
}
function returnFields(env, provider = 'stripe') {
  const order = env.context.checkoutOrders_(env.sheet)[0];
  const access = env.context.checkoutAccessToken_(order, env.properties.CHECKOUT_TOKEN_SECRET);
  return { action: 'return', provider, order: order.orderId, access,
    ...(provider === 'stripe' ? { session_id: order.providerId } : { token: order.providerId }) };
}
function paypalOrder(env, status = 'APPROVED', overrides = {}) {
  const order = env.context.checkoutOrders_(env.sheet)[0];
  const unit = { reference_id: order.orderId, custom_id: order.orderId, invoice_id: order.orderId,
    amount: { currency_code: 'AUD', value: '55.00' } };
  if (status === 'COMPLETED') unit.payments = { captures: [{ id: 'MOCKCAPTURE123', status: 'COMPLETED', final_capture: true,
    amount: { currency_code: 'AUD', value: '55.00' } }] };
  return { id: 'MOCKPAYPAL123', intent: 'CAPTURE', status, purchase_units: [unit], ...overrides };
}
function mockPayPalCreate(env) {
  env.respond((url, options) => {
    if (url.endsWith('/v1/oauth2/token')) return { body: { access_token: 'mock-token' } };
    assert.equal(url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
    const payload = JSON.parse(options.payload);
    assert.equal(payload.purchase_units[0].amount.value, '55.00');
    return { body: { id: 'MOCKPAYPAL123', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCKPAYPAL123' }] } };
  });
  post(env, input({ paymentMethod: 'paypal' }));
}
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('server prices every count and ignores tampered browser amount/package', () => {
  const env = environment();
  [2000, 3500, 4500, 5500].forEach((price, index) => {
    const validated = env.context.validateCheckoutInput_(input({ albums: slugs.slice(0, index + 1).join(','), amountCents: '1', packageId: 'free' }));
    assert.equal(validated.amountCents, price);
  });
});
test('unknown, empty and duplicate albums cannot reach providers', () => {
  const env = environment();
  ['unknown-album', '', 'songs-of-straddie,songs-of-straddie', '__proto__'].forEach(albums => {
    assert.throws(() => env.context.validateCheckoutInput_(input({ albums })), /invalid_albums|duplicate_albums/);
  });
  post(env, input({ albums: 'unknown-album' }));
  assert.equal(env.calls.length, 0);
  assert.equal(env.rows.length, 0);
});
test('fixed-price checkout rejects physical delivery, video-only, invalid method/email and invalid UUID', () => {
  const env = environment();
  [{ delivery: 'usb' }, { filePreference: 'video' }, { paymentMethod: 'free' }, { buyerEmail: 'bad-email' }, { requestId: '123' }, { buyerName: 'a'.repeat(121) }]
    .forEach(data => assert.throws(() => env.context.validateCheckoutInput_(input(data))));
});
test('duplicate form posts reuse one order/session; changed cart with same request is rejected', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options));
  const html = post(env); post(env);
  assert.match(html, /Continue to Stripe/);
  assert.equal(env.calls.length, 1);
  assert.equal(env.rows.length, 2);
  assert.equal(env.calls[0].options.headers['Idempotency-Key'], requestId);
  assert.equal(env.calls[0].options.payload['line_items[0][price_data][unit_amount]'], '5500');
  assert.match(post(env, input({ albums: slugs[0] })), /Please check your order/);
  assert.equal(env.calls.length, 1);
});
test('callbacks use real query parameters and secret access token is not stored in sheet', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options)); post(env);
  const fields = returnFields(env);
  const success = env.calls[0].options.payload.success_url;
  assert.ok(success.includes('?action=return&provider=stripe&'));
  assert.ok(success.endsWith('&session_id={CHECKOUT_SESSION_ID}'));
  assert.ok(!success.includes('#'));
  assert.ok(!JSON.stringify(env.rows).includes(fields.access));
  assert.ok(!JSON.stringify(env.rows).includes(env.properties.STRIPE_SECRET_KEY));
  const calls = env.calls.length;
  env.context.doGet({ parameter: { ...fields, access: 'a'.repeat(43) } });
  env.context.doGet({ parameter: { ...fields, session_id: 'cs_test_OTHER' } });
  assert.equal(env.calls.length, calls);
  assert.equal(env.emails.length, 0);
});
test('unpaid Stripe return never marks paid or sends fulfilment notification', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options)); post(env);
  env.respond(() => ({ body: stripeSession(env, { status: 'open', payment_status: 'unpaid' }) }));
  assert.match(env.context.doGet({ parameter: returnFields(env) }), /Payment is being checked/);
  assert.equal(env.context.checkoutOrders_(env.sheet)[0].status, 'checkout_open');
  assert.equal(env.emails.length, 0);
});
test('Stripe amount, currency, mode, order and albums are independently matched', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options)); post(env);
  const order = env.context.checkoutOrders_(env.sheet)[0]; const config = env.context.checkoutConfig_('stripe');
  const changes = [{ amount_total: 1 }, { currency: 'usd' }, { livemode: true }, { client_reference_id: 'other' },
    { metadata: { order_id: 'other', album_ids: order.albums } }, { metadata: { order_id: order.orderId, album_ids: slugs[0] } }];
  changes.forEach(change => assert.throws(() => env.context.assertStripeMatch_(order, stripeSession(env, change), config), /stripe_payment_mismatch/));
});
test('verified Stripe payment sends only one owner email and no files or customer email', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options)); post(env);
  env.respond(() => ({ body: stripeSession(env) }));
  const fields = returnFields(env);
  const html = env.context.doGet({ parameter: fields });
  env.context.doGet({ parameter: fields });
  assert.match(html, /Test payment verified/);
  assert.equal(env.context.checkoutOrders_(env.sheet)[0].status, 'paid');
  assert.equal(env.emails.length, 1);
  assert.equal(env.emails[0].to, 'owner@example.test');
  assert.ok(!html.includes('listener@example.test'));
});
test('PayPal creates an AUD order and distinct idempotent capture then verifies retrieved payment', () => {
  const env = environment(); mockPayPalCreate(env);
  const fields = returnFields(env, 'paypal');
  let captured = false;
  env.respond((url, options) => {
    if (url.endsWith('/v1/oauth2/token')) return { body: { access_token: 'mock-token' } };
    if (url.endsWith('/capture')) { captured = true; return { body: paypalOrder(env, 'COMPLETED') }; }
    return { body: paypalOrder(env, captured ? 'COMPLETED' : 'APPROVED') };
  });
  assert.match(env.context.doGet({ parameter: fields }), /Test payment verified/);
  const createCall = env.calls.find(call => call.url.endsWith('/v2/checkout/orders'));
  const captureCall = env.calls.find(call => call.url.endsWith('/capture'));
  assert.equal(createCall.options.headers['PayPal-Request-Id'], requestId);
  assert.notEqual(captureCall.options.headers['PayPal-Request-Id'], requestId);
  env.context.doGet({ parameter: fields });
  assert.equal(env.calls.filter(call => call.url.endsWith('/capture')).length, 1);
  assert.equal(env.emails.length, 1);
});
test('PayPal approval alone, pending capture and substituted amounts are not paid', () => {
  const env = environment(); mockPayPalCreate(env);
  const order = env.context.checkoutOrders_(env.sheet)[0]; const config = env.context.checkoutConfig_('paypal');
  assert.equal(env.context.verifiedPayPalCapture_(order, paypalOrder(env), config), '');
  const pending = paypalOrder(env, 'COMPLETED'); pending.purchase_units[0].payments.captures[0].status = 'PENDING';
  assert.equal(env.context.verifiedPayPalCapture_(order, pending, config), '');
  for (const field of ['reference_id', 'custom_id', 'invoice_id']) {
    const mismatch = paypalOrder(env, 'COMPLETED'); mismatch.purchase_units[0][field] = 'wrong';
    assert.throws(() => env.context.verifiedPayPalCapture_(order, mismatch, config), /paypal_payment_mismatch/);
  }
  const badCapture = paypalOrder(env, 'COMPLETED'); badCapture.purchase_units[0].payments.captures[0].amount.value = '0.01';
  assert.throws(() => env.context.verifiedPayPalCapture_(order, badCapture, config), /paypal_capture_mismatch/);
});
test('uncertain PayPal capture is recovered by server retrieval without duplicate charge', () => {
  const env = environment(); mockPayPalCreate(env); let captured = false;
  env.respond((url) => {
    if (url.endsWith('/v1/oauth2/token')) return { body: { access_token: 'mock-token' } };
    if (url.endsWith('/capture')) { captured = true; return { status: 422, body: { message: 'already captured' } }; }
    return { body: paypalOrder(env, captured ? 'COMPLETED' : 'APPROVED') };
  });
  env.context.doGet({ parameter: returnFields(env, 'paypal') });
  assert.equal(env.context.checkoutOrders_(env.sheet)[0].status, 'paid');
  assert.equal(env.calls.filter(call => call.url.endsWith('/capture')).length, 1);
});
test('scheduled reconciliation finds paid Stripe orders without buyer return', () => {
  const env = environment(); env.respond((url, options) => stripeCreate(env, url, options)); post(env);
  env.respond(() => ({ body: stripeSession(env) }));
  assert.equal(env.context.reconcileCheckoutPayments(), 1);
  assert.equal(env.context.checkoutOrders_(env.sheet)[0].status, 'paid');
  assert.equal(env.emails.length, 1);
});
test('reconciliation rotates beyond ten abandoned sessions to find newer paid orders', () => {
  const env = environment();
  const config = env.context.checkoutConfig_('stripe');
  env.context.checkoutSheet_(config);
  const orders = [];
  for (let index = 0; index < 11; index += 1) {
    const data = env.context.validateCheckoutInput_(input({ requestId: crypto.randomUUID() }));
    const order = env.context.findOrCreateOrder_(env.sheet, data, config);
    env.context.updateCheckoutOrder_(env.sheet, order, { providerId: 'cs_test_MOCK' + index, status: 'checkout_open' });
    orders.push(order);
  }
  env.respond(url => {
    const order = orders.find(item => url.endsWith('/' + item.providerId));
    assert.ok(order);
    const paid = order === orders[10];
    return { body: { id: order.providerId, mode: 'payment', currency: 'aud', amount_total: 5500, livemode: false,
      status: paid ? 'complete' : 'open', payment_status: paid ? 'paid' : 'unpaid', client_reference_id: order.orderId,
      metadata: { order_id: order.orderId, album_ids: order.albums }, payment_intent: 'pi_NEWER' } };
  });
  env.context.reconcileCheckoutPayments();
  assert.equal(env.emails.length, 0);
  env.context.reconcileCheckoutPayments();
  assert.equal(env.context.checkoutOrders_(env.sheet)[10].status, 'paid');
  assert.equal(env.emails.length, 1);
});
test('sheet formula inputs are escaped; raw order JSON remains literal and error bodies stay private', () => {
  const env = environment(); env.respond(() => ({ status: 400, body: { error: { message: 'provider-secret-response' } } }));
  const html = post(env, input({ buyerName: '=IMPORTXML("x")' }));
  assert.ok(JSON.stringify(env.rows).includes("'=IMPORTXML"));
  assert.ok(!JSON.stringify(env.rows).includes('provider-secret-response'));
  assert.ok(!html.includes('provider-secret-response'));
  assert.equal(env.context.checkoutOrders_(env.sheet)[0].lastErrorCode, 'stripe_http_400');
});
test('network retry keeps the same Stripe idempotency key', () => {
  const env = environment(); let attempt = 0;
  env.respond((url, options) => ++attempt === 1 ? { status: 503, body: {} } : stripeCreate(env, url, options));
  post(env);
  assert.equal(env.calls.length, 2);
  assert.ok(env.calls.every(call => call.options.headers['Idempotency-Key'] === requestId));
});
test('repeated parameters and honeypot cannot create an order', () => {
  const env = environment();
  env.context.doPost({ parameter: input(), parameters: { albums: [slugs[0], slugs[1]] } });
  post(env, input({ website: 'spam' }));
  assert.equal(env.calls.length, 0);
  assert.equal(env.rows.length, 0);
});
test('unsafe redirect hosts are rejected and missing config cannot charge', () => {
  const env = environment();
  assert.equal(env.context.validProviderUrl_('https://checkout.stripe.com.evil.test/x', 'stripe', 'test'), false);
  assert.equal(env.context.validProviderUrl_('https://www.paypal.com/checkoutnow?token=x', 'paypal', 'test'), false);
  delete env.properties.CHECKOUT_TOKEN_SECRET;
  post(env);
  assert.equal(env.calls.length, 0);
});

let failures = 0;
for (const { name, run } of tests) {
  try { run(); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { failures += 1; process.stderr.write(`FAIL ${name}\n${error.stack}\n`); }
}
if (failures) process.exitCode = 1;
else process.stdout.write(`\n${tests.length} mocked checkout tests passed. No external services were used.\n`);
