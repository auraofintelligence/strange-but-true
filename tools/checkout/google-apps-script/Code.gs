/**
 * Strange but True digital-album checkout. Deploy as a dedicated Apps Script web app.
 * All credentials belong in Script Properties, never in this file or the website.
 * Delivery remains manual. A redirect is never proof of payment.
 */
const CHECKOUT_ALBUMS = Object.freeze({
  "songs-of-straddie": "Songs of Straddie",
  "chronicles-of-the-forgotten": "Chronicles of the Forgotten",
  "starseed-code-from-aura-to-infinity": "Starseed Code: From Aura to Infinity",
  "a-protopian-gambit": "A Protopian Gambit",
});
const CHECKOUT_PRICES = Object.freeze([0, 2000, 3500, 4500, 5500]);
const CHECKOUT_HEADERS = [
  "createdAt", "orderId", "requestId", "requestHash", "accessHash", "mode",
  "status", "paymentMethod", "amountCents", "currency", "albums", "buyerName",
  "buyerEmail", "filePreference", "payloadJson", "providerId", "approvalUrl",
  "captureRequestId", "paymentReference", "paidAt", "notificationStatus", "lastErrorCode",
];
const CHECKOUT_SITE = "https://auraofintelligence.github.io/strange-but-true/downloads.html#order-music";

function doPost(e) {
  try {
    if (String(e && e.parameter && e.parameter.website || "").trim()) {
      return checkoutPage_("Order not accepted", "Please return to the catalogue and try again.");
    }
    rejectRepeatedFields_(e);
    const input = validateCheckoutInput_(e && e.parameter || {});
    const config = checkoutConfig_(input.paymentMethod);
    return withCheckoutLock_(function () {
      const sheet = checkoutSheet_(config);
      const order = findOrCreateOrder_(sheet, input, config);
      if (order.status === "paid") {
        notifyPaidOrder_(sheet, order, config);
        return paidCheckoutPage_(order);
      }
      if (order.mode !== config.mode) throw checkoutError_("mode_changed");
      if (order.approvalUrl && order.providerId) {
        if (Date.now() - Number(order.createdAt) > 23 * 60 * 60 * 1000) {
          return checkoutPage_("Start a fresh checkout", "This checkout is old. Return to the catalogue and start a new order. If you may already have paid, contact Luke before paying again.");
        }
        return checkoutRedirect_(order.approvalUrl, order.paymentMethod);
      }
      // Do not recreate uncertain provider requests after their idempotency window.
      if (Date.now() - Number(order.createdAt) > 60 * 60 * 1000) throw checkoutError_("request_expired");
      try {
        const access = checkoutAccessToken_(order, config.tokenSecret);
        const created = order.paymentMethod === "stripe"
          ? createStripeCheckout_(order, config, access)
          : createPayPalCheckout_(order, config, access);
        updateCheckoutOrder_(sheet, order, {
          providerId: created.id, approvalUrl: created.url, status: "checkout_open", lastErrorCode: "",
        });
        return checkoutRedirect_(created.url, order.paymentMethod);
      } catch (error) {
        updateCheckoutOrder_(sheet, order, { status: "setup_error", lastErrorCode: safeErrorCode_(error) });
        throw error;
      }
    });
  } catch (error) {
    return checkoutErrorPage_(error);
  }
}

function doGet(e) {
  const fields = e && e.parameter || {};
  if (!fields.action) return checkoutPage_("Strange but True checkout", "Choose your albums on the catalogue page to begin a purchase.");
  try {
    rejectRepeatedFields_(e);
    if (!["return", "cancel"].includes(fields.action)) throw checkoutError_("invalid_return");
    const orderId = checkedText_(fields.order, 4, 80, "invalid_return");
    const access = checkedText_(fields.access, 43, 64, "invalid_return");
    if (!/^SBT-[a-f0-9-]{36}$/.test(orderId) || !/^[A-Za-z0-9_-]+$/.test(access)) throw checkoutError_("invalid_return");
    const config = checkoutConfig_();
    return withCheckoutLock_(function () {
      const sheet = checkoutSheet_(config);
      const order = findCheckoutOrder_(sheet, "orderId", orderId);
      if (!order || !constantTimeEqual_(sha256_(access), String(order.accessHash))) throw checkoutError_("invalid_return");
      if (fields.provider !== order.paymentMethod || order.mode !== config.mode) throw checkoutError_("invalid_return");
      if (order.status === "paid") {
        notifyPaidOrder_(sheet, order, config);
        return paidCheckoutPage_(order);
      }
      if (fields.action === "cancel") {
        return checkoutPage_("Payment not confirmed", "You returned from checkout. No payment is confirmed here. If you completed a payment, Luke will check it before delivery. Please contact him before paying again if you are unsure.", order.orderId);
      }
      const returnedId = order.paymentMethod === "stripe" ? fields.session_id : fields.token;
      if (!order.providerId || returnedId !== order.providerId) throw checkoutError_("invalid_return");
      const providerConfig = checkoutConfig_(order.paymentMethod);
      const result = reconcileCheckoutOrder_(sheet, order, providerConfig);
      if (result === "paid") return paidCheckoutPage_(order);
      return checkoutPage_("Payment is being checked", "The payment provider has not confirmed a completed payment. Luke will check the order before sending the agreed files. Please keep your provider receipt and contact him if needed.", order.orderId);
    });
  } catch (error) {
    return checkoutErrorPage_(error);
  }
}

/** Run on a ten-minute time trigger; also safe to run manually from the editor. */
function reconcileCheckoutPayments() {
  const config = checkoutConfig_();
  return withCheckoutLock_(function () {
    const sheet = checkoutSheet_(config);
    const orders = checkoutOrders_(sheet);
    const properties = PropertiesService.getScriptProperties();
    const savedCursor = Number(properties.getProperty("CHECKOUT_RECONCILE_CURSOR")) || 0;
    let index = orders.length ? Math.max(0, savedCursor) % orders.length : 0;
    let visited = 0;
    let checked = 0;
    while (visited < orders.length && checked < 10) {
      const order = orders[index];
      index = (index + 1) % orders.length;
      visited += 1;
      if (order.mode !== config.mode) continue;
      if (order.status === "paid" && order.notificationStatus !== "sent") {
        checked += 1;
        notifyPaidOrder_(sheet, order, config);
        continue;
      }
      if (order.status !== "checkout_open" || !order.providerId) continue;
      checked += 1;
      try {
        reconcileCheckoutOrder_(sheet, order, checkoutConfig_(order.paymentMethod));
      } catch (error) {
        updateCheckoutOrder_(sheet, order, { lastErrorCode: safeErrorCode_(error) });
      }
    }
    // Rotate the next starting point so abandoned checkouts cannot starve newer payments.
    properties.setProperty("CHECKOUT_RECONCILE_CURSOR", String(index));
    return checked;
  });
}

function validateCheckoutInput_(fields) {
  const raw = checkedText_(fields.albums, 1, 300, "invalid_albums");
  const albums = raw.split(",").map(function (id) { return id.trim(); });
  if (!albums.length || albums.length > 4 || albums.some(function (id) { return !Object.prototype.hasOwnProperty.call(CHECKOUT_ALBUMS, id); })) throw checkoutError_("invalid_albums");
  if (new Set(albums).size !== albums.length) throw checkoutError_("duplicate_albums");
  albums.sort();
  const paymentMethod = checkedText_(fields.paymentMethod, 1, 10, "invalid_payment");
  if (!["stripe", "paypal"].includes(paymentMethod)) throw checkoutError_("invalid_payment");
  if (fields.delivery !== "download") throw checkoutError_("unsupported_delivery");
  if (!["audio", "audio-video"].includes(fields.filePreference)) throw checkoutError_("unsupported_files");
  const buyerName = checkedText_(fields.buyerName, 1, 120, "invalid_buyer");
  const buyerEmail = checkedText_(fields.buyerEmail, 3, 254, "invalid_buyer").toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(buyerEmail)) throw checkoutError_("invalid_buyer");
  const requestId = checkedText_(fields.requestId, 36, 36, "invalid_request").toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) throw checkoutError_("invalid_request");
  // Browser-supplied amounts, package IDs and return URLs are intentionally unused.
  return { albums: albums, paymentMethod: paymentMethod, buyerName: buyerName, buyerEmail: buyerEmail,
    delivery: "download", filePreference: fields.filePreference, requestId: requestId,
    amountCents: CHECKOUT_PRICES[albums.length], currency: "AUD" };
}

function findOrCreateOrder_(sheet, input, config) {
  const payloadJson = JSON.stringify(input);
  const requestHash = sha256_(payloadJson);
  const existing = findCheckoutOrder_(sheet, "requestId", input.requestId);
  if (existing) {
    if (!constantTimeEqual_(requestHash, String(existing.requestHash))) throw checkoutError_("request_changed");
    return existing;
  }
  const order = {
    createdAt: Date.now(), orderId: "SBT-" + Utilities.getUuid().toLowerCase(),
    requestId: input.requestId, requestHash: requestHash, mode: config.mode,
    status: "received", paymentMethod: input.paymentMethod, amountCents: input.amountCents,
    currency: input.currency, albums: input.albums.join(","), buyerName: input.buyerName,
    buyerEmail: input.buyerEmail, filePreference: input.filePreference, payloadJson: payloadJson,
    captureRequestId: Utilities.getUuid().toLowerCase(), providerId: "", approvalUrl: "",
    paymentReference: "", paidAt: "", notificationStatus: "", lastErrorCode: "",
  };
  order.accessHash = sha256_(checkoutAccessToken_(order, config.tokenSecret));
  sheet.appendRow(CHECKOUT_HEADERS.map(function (key) { return spreadsheetText_(order[key]); }));
  order._row = sheet.getLastRow();
  SpreadsheetApp.flush();
  return order;
}

function createStripeCheckout_(order, config, access) {
  const input = JSON.parse(order.payloadJson);
  const success = callbackUrl_(config, order, access, "return") + "&session_id={CHECKOUT_SESSION_ID}";
  const payload = {
    mode: "payment", success_url: success, cancel_url: callbackUrl_(config, order, access, "cancel"),
    customer_email: input.buyerEmail, client_reference_id: order.orderId,
    "payment_method_types[0]": "card", "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": String(order.amountCents),
    "line_items[0][price_data][product_data][name]": albumPackageName_(input.albums.length),
    "line_items[0][price_data][product_data][description]": input.albums.map(function (id) { return CHECKOUT_ALBUMS[id]; }).join("; "),
    "line_items[0][quantity]": "1", "metadata[order_id]": order.orderId,
    "metadata[album_ids]": order.albums, "metadata[file_preference]": order.filePreference,
    "payment_intent_data[metadata][order_id]": order.orderId,
  };
  const session = requestJson_("https://api.stripe.com/v1/checkout/sessions", {
    method: "post", payload: payload,
    headers: stripeHeaders_(config, order.requestId),
  }, "stripe");
  if (!/^cs_[A-Za-z0-9_]+$/.test(session.id || "") || !validProviderUrl_(session.url, "stripe", config.mode)
      || session.client_reference_id !== order.orderId || !session.metadata || session.metadata.order_id !== order.orderId
      || session.amount_total !== Number(order.amountCents) || session.currency !== "aud"
      || session.livemode !== (config.mode === "live")) throw checkoutError_("stripe_response_mismatch");
  return { id: session.id, url: session.url };
}

function createPayPalCheckout_(order, config, access) {
  const input = JSON.parse(order.payloadJson);
  const payload = {
    intent: "CAPTURE",
    purchase_units: [{ reference_id: order.orderId, custom_id: order.orderId, invoice_id: order.orderId,
      description: albumPackageName_(input.albums.length),
      amount: { currency_code: "AUD", value: (Number(order.amountCents) / 100).toFixed(2) } }],
    payment_source: { paypal: { experience_context: {
      brand_name: "Strange but True", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW",
      return_url: callbackUrl_(config, order, access, "return"), cancel_url: callbackUrl_(config, order, access, "cancel"),
    } } },
  };
  const result = paypalRequest_(config, "/v2/checkout/orders", "post", payload, order.requestId);
  const approval = (result.links || []).find(function (link) { return ["payer-action", "approve"].includes(link.rel); });
  if (!/^[A-Z0-9]{8,64}$/.test(result.id || "") || !approval || !validProviderUrl_(approval.href, "paypal", config.mode)) throw checkoutError_("paypal_response_mismatch");
  return { id: result.id, url: approval.href };
}

function reconcileCheckoutOrder_(sheet, order, config) {
  if (order.status === "paid") return "paid";
  let reference = "";
  if (order.paymentMethod === "stripe") {
    if (!/^cs_[A-Za-z0-9_]+$/.test(order.providerId || "")) throw checkoutError_("invalid_provider_id");
    const session = requestJson_("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(order.providerId), {
      method: "get", headers: stripeHeaders_(config),
    }, "stripe");
    assertStripeMatch_(order, session, config);
    if (session.status === "expired") {
      updateCheckoutOrder_(sheet, order, { status: "expired" });
      return "pending";
    }
    if (session.status !== "complete" || session.payment_status !== "paid") return "pending";
    reference = typeof session.payment_intent === "string" ? session.payment_intent : order.providerId;
  } else {
    if (!/^[A-Z0-9]{8,64}$/.test(order.providerId || "")) throw checkoutError_("invalid_provider_id");
    const path = "/v2/checkout/orders/" + encodeURIComponent(order.providerId);
    let result = paypalRequest_(config, path, "get");
    assertPayPalMatch_(order, result, config);
    if (result.status === "APPROVED") {
      // Approval alone is not payment. Capture using a separate stable idempotency ID.
      try {
        paypalRequest_(config, path + "/capture", "post", {}, order.captureRequestId);
      } catch (error) {
        // An uncertain capture may already have completed. Always retrieve before deciding.
        if (!/^paypal_(http_|network)/.test(safeErrorCode_(error))) throw error;
      }
      result = paypalRequest_(config, path, "get");
      assertPayPalMatch_(order, result, config);
    }
    reference = verifiedPayPalCapture_(order, result, config);
    if (!reference) {
      if (["VOIDED"].includes(result.status) || Date.now() - Number(order.createdAt) > 72 * 60 * 60 * 1000) updateCheckoutOrder_(sheet, order, { status: "expired" });
      return "pending";
    }
  }
  updateCheckoutOrder_(sheet, order, {
    status: "paid", paymentReference: reference, paidAt: new Date().toISOString(), lastErrorCode: "",
  });
  SpreadsheetApp.flush();
  notifyPaidOrder_(sheet, order, config);
  return "paid";
}

function assertStripeMatch_(order, session, config) {
  if (session.id !== order.providerId || session.mode !== "payment" || session.currency !== "aud"
      || session.amount_total !== Number(order.amountCents) || session.client_reference_id !== order.orderId
      || !session.metadata || session.metadata.order_id !== order.orderId || session.metadata.album_ids !== order.albums
      || session.livemode !== (config.mode === "live")) throw checkoutError_("stripe_payment_mismatch");
}

function assertPayPalMatch_(order, result, config) {
  const units = result.purchase_units;
  if (result.id !== order.providerId || result.intent !== "CAPTURE" || !Array.isArray(units) || units.length !== 1) throw checkoutError_("paypal_payment_mismatch");
  const unit = units[0];
  if (unit.reference_id !== order.orderId || unit.custom_id !== order.orderId || unit.invoice_id !== order.orderId
      || !unit.amount || unit.amount.currency_code !== "AUD" || moneyCents_(unit.amount.value) !== Number(order.amountCents)
      || (config.paypalMerchantId && (!unit.payee || unit.payee.merchant_id !== config.paypalMerchantId))) throw checkoutError_("paypal_payment_mismatch");
}

function verifiedPayPalCapture_(order, result, config) {
  assertPayPalMatch_(order, result, config);
  if (result.status !== "COMPLETED") return "";
  const payments = result.purchase_units[0].payments || {};
  const captures = payments.captures;
  if (!Array.isArray(captures) || captures.length !== 1) throw checkoutError_("paypal_capture_mismatch");
  const capture = captures[0];
  if (capture.status !== "COMPLETED") return "";
  if (!/^[A-Z0-9]{8,64}$/.test(capture.id || "") || !capture.amount || capture.amount.currency_code !== "AUD"
      || moneyCents_(capture.amount.value) !== Number(order.amountCents) || capture.final_capture !== true) throw checkoutError_("paypal_capture_mismatch");
  return capture.id;
}

function notifyPaidOrder_(sheet, order, config) {
  if (order.status !== "paid" || order.notificationStatus === "sent") return;
  const input = JSON.parse(order.payloadJson);
  try {
    MailApp.sendEmail({
      to: config.ownerEmail,
      subject: (order.mode === "test" ? "[TEST] " : "") + "Paid music order " + order.orderId,
      body: ["Payment verified server-side. Manual digital delivery is required.",
        "Order: " + order.orderId, "Provider: " + order.paymentMethod, "Payment reference: " + order.paymentReference,
        "Amount: AUD " + (Number(order.amountCents) / 100).toFixed(2), "Name: " + input.buyerName,
        "Delivery email: " + input.buyerEmail, "Files requested: " + input.filePreference,
        "Albums:", input.albums.map(function (id) { return "- " + CHECKOUT_ALBUMS[id]; }).join("\n"),
        "", "Check the provider dashboard for refunds/disputes before delivery. No files have been automatically unlocked."]
        .join("\n"),
    });
    updateCheckoutOrder_(sheet, order, { notificationStatus: "sent" });
  } catch (error) {
    updateCheckoutOrder_(sheet, order, { notificationStatus: "retry" });
  }
}

function stripeHeaders_(config, idempotencyKey) {
  const headers = { Authorization: "Bearer " + config.stripeSecret, "Stripe-Version": config.stripeVersion };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
}

function paypalRequest_(config, path, method, payload, idempotencyKey) {
  const token = requestJson_(config.paypalBase + "/v1/oauth2/token", {
    method: "post", payload: { grant_type: "client_credentials" },
    headers: { Authorization: "Basic " + Utilities.base64Encode(config.paypalClientId + ":" + config.paypalSecret) },
  }, "paypal");
  if (!token.access_token) throw checkoutError_("paypal_auth_error");
  const headers = { Authorization: "Bearer " + token.access_token, Prefer: "return=representation" };
  if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;
  const options = { method: method, headers: headers };
  if (payload !== undefined) { options.contentType = "application/json"; options.payload = JSON.stringify(payload); }
  return requestJson_(config.paypalBase + path, options, "paypal");
}

function requestJson_(url, options, provider) {
  options.muteHttpExceptions = true;
  let failure = provider + "_network";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try { response = UrlFetchApp.fetch(url, options); } catch (error) {
      if (attempt < 2) { Utilities.sleep(250 * (attempt + 1)); continue; }
      throw checkoutError_(failure);
    }
    const status = response.getResponseCode();
    if (status >= 200 && status < 300) {
      try { return JSON.parse(response.getContentText()); } catch (error) { throw checkoutError_(provider + "_invalid_json"); }
    }
    // Store only a non-sensitive error code; never response bodies or credentials.
    failure = provider + "_http_" + status;
    if ((status === 429 || status >= 500) && attempt < 2) { Utilities.sleep(250 * (attempt + 1)); continue; }
    throw checkoutError_(failure);
  }
  throw checkoutError_(failure);
}

function checkoutConfig_(provider) {
  const properties = PropertiesService.getScriptProperties();
  const get = function (key, fallback) { return String(properties.getProperty(key) || fallback || "").trim(); };
  const config = {
    spreadsheetId: get("SPREADSHEET_ID"), sheetName: get("SHEET_NAME", "Checkout Orders"),
    endpoint: get("CHECKOUT_ENDPOINT_URL"), mode: get("CHECKOUT_MODE", "test"),
    tokenSecret: get("CHECKOUT_TOKEN_SECRET"), ownerEmail: get("OWNER_EMAIL"),
    stripeSecret: get("STRIPE_SECRET_KEY"), stripeVersion: get("STRIPE_API_VERSION", "2026-10-28.endive"),
    paypalClientId: get("PAYPAL_CLIENT_ID"), paypalSecret: get("PAYPAL_CLIENT_SECRET"), paypalMerchantId: get("PAYPAL_MERCHANT_ID"),
  };
  if (!config.spreadsheetId || !["test", "live"].includes(config.mode)
      || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint)
      || config.tokenSecret.length < 43 || config.tokenSecret.length > 512
      || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.ownerEmail)) throw checkoutError_("configuration_missing");
  if (provider === "stripe" && (!config.stripeSecret || !new RegExp("^(sk|rk)_" + config.mode + "_").test(config.stripeSecret))) throw checkoutError_("configuration_missing");
  if (provider === "paypal" && (!config.paypalClientId || !config.paypalSecret)) throw checkoutError_("configuration_missing");
  config.paypalBase = config.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  return config;
}

function checkoutSheet_(config) {
  const book = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = book.getSheetByName(config.sheetName) || book.insertSheet(config.sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CHECKOUT_HEADERS.length).setValues([CHECKOUT_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), CHECKOUT_HEADERS.length)).getValues()[0];
    if (headers.join("|") !== CHECKOUT_HEADERS.join("|")) throw checkoutError_("sheet_headers_mismatch");
  }
  return sheet;
}

function checkoutOrders_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKOUT_HEADERS.length).getValues().map(function (row, index) {
    const order = { _row: index + 2 };
    CHECKOUT_HEADERS.forEach(function (key, column) { order[key] = row[column]; });
    return order;
  });
}

function findCheckoutOrder_(sheet, key, value) {
  return checkoutOrders_(sheet).find(function (order) { return String(order[key]) === value; }) || null;
}

function updateCheckoutOrder_(sheet, order, changes) {
  Object.keys(changes).forEach(function (key) {
    const column = CHECKOUT_HEADERS.indexOf(key);
    if (column < 0) throw checkoutError_("unknown_order_field");
    sheet.getRange(order._row, column + 1).setValue(spreadsheetText_(changes[key]));
    order[key] = changes[key];
  });
}

function spreadsheetText_(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return value;
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function checkoutAccessToken_(order, secret) {
  const bytes = Utilities.computeHmacSha256Signature(order.orderId + "|" + order.requestId, secret, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(function (byte) { return ((byte + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function moneyCents_(value) {
  if (typeof value !== "string" || !/^\d{1,9}\.\d{2}$/.test(value)) return -1;
  const parts = value.split(".");
  return Number(parts[0]) * 100 + Number(parts[1]);
}

function callbackUrl_(config, order, access, action) {
  return config.endpoint + "?action=" + action + "&provider=" + order.paymentMethod
    + "&order=" + encodeURIComponent(order.orderId) + "&access=" + encodeURIComponent(access);
}

function validProviderUrl_(url, provider, mode) {
  if (typeof url !== "string") return false;
  return provider === "stripe" ? /^https:\/\/checkout\.stripe\.com\//.test(url)
    : new RegExp("^https://" + (mode === "live" ? "www\\.paypal\\.com" : "www\\.sandbox\\.paypal\\.com") + "/checkoutnow\\?").test(url);
}

function checkedText_(value, min, max, code) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) throw checkoutError_(code);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw checkoutError_(code);
  return clean;
}

function rejectRepeatedFields_(e) {
  if (e && e.parameters && Object.keys(e.parameters).some(function (key) { return e.parameters[key].length !== 1; })) throw checkoutError_("repeated_fields");
}

function withCheckoutLock_(action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw checkoutError_("checkout_busy");
  try { return action(); } finally { lock.releaseLock(); }
}

function albumPackageName_(count) {
  return count === 4 ? "I C. Infinity — all four completed albums" : "I C. Infinity — " + count + (count === 1 ? " album" : " albums");
}

function checkoutError_(code) {
  const error = new Error(code);
  error.checkoutCode = code;
  return error;
}

function safeErrorCode_(error) {
  return error && /^[a-z0-9_]{1,60}$/.test(error.checkoutCode || "") ? error.checkoutCode : "checkout_unavailable";
}

function checkoutErrorPage_(error) {
  const code = safeErrorCode_(error);
  const invalid = /^(invalid_|duplicate_|unsupported_|request_changed|repeated_fields)/.test(code);
  return checkoutPage_(invalid ? "Please check your order" : "Checkout could not finish",
    invalid ? "Return to the catalogue, choose your albums and check your delivery details. Start a fresh checkout after changing a previous order."
      : "Please contact Luke before trying to pay again if you may already have completed a payment. Keep your payment-provider receipt. The checkout has not confirmed payment on this page.");
}

function paidCheckoutPage_(order) {
  return checkoutPage_(order.mode === "test" ? "Test payment verified" : "Payment verified",
    order.mode === "test" ? "This was a test checkout. No live purchase has been made."
      : "Thank you. The payment provider has confirmed your payment. Luke will send the agreed digital files to the delivery email on your order after checking the order. Delivery is handled manually; this page does not unlock an instant download.", order.orderId);
}

function checkoutRedirect_(url, provider) {
  const config = checkoutConfig_();
  if (!validProviderUrl_(url, provider, config.mode)) throw checkoutError_("invalid_provider_url");
  const safeUrl = escapeCheckoutHtml_(url);
  // The visible link remains usable if Google's sandbox blocks top-frame navigation.
  return HtmlService.createHtmlOutput(checkoutHtmlHead_("Continue to payment")
    + "<h1>Continue to " + (provider === "stripe" ? "Stripe" : "PayPal") + "</h1>"
    + '<p>Your secure payment page is ready.</p><p><a class="button" target="_top" rel="noreferrer" href="' + safeUrl + '">Continue to payment</a></p>'
    + '<script>window.top.location.href=' + JSON.stringify(url).replace(/</g, "\\u003c") + ";</script></main></body></html>");
}

function checkoutPage_(title, message, orderId) {
  return HtmlService.createHtmlOutput(checkoutHtmlHead_(title) + "<h1>" + escapeCheckoutHtml_(title) + "</h1><p>"
    + escapeCheckoutHtml_(message) + "</p>" + (orderId ? "<p>Order reference: <strong>" + escapeCheckoutHtml_(orderId) + "</strong></p>" : "")
    + '<p><a class="button" rel="noreferrer" target="_top" href="' + CHECKOUT_SITE + '">Return to the music catalogue</a></p><p><a href="https://auraofintelligence.github.io/strange-but-true/contact.html" target="_top" rel="noreferrer">Contact Luke</a></p></main></body></html>');
}

function checkoutHtmlHead_(title) {
  return '<!doctype html><html lang="en"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Cache-Control" content="no-store"><title>'
    + escapeCheckoutHtml_(title) + ' | Strange but True</title><style>body{margin:0;background:#101020;color:#f7f3ff;font:18px/1.6 system-ui,sans-serif}main{max-width:720px;margin:3rem auto;padding:1.5rem}h1{line-height:1.1}a{color:#5fd8ff}.button{display:inline-block;background:#8f4dff;color:white;border-radius:8px;padding:.8rem 1rem;text-decoration:none}strong{overflow-wrap:anywhere}a:focus-visible{outline:3px solid #5fd8ff;outline-offset:4px}</style></head><body><main><p>STRANGE BUT TRUE · MUSIC</p>';
}

function escapeCheckoutHtml_(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
