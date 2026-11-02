(() => {
  const albums = {
    "songs-of-straddie": "Songs of Straddie",
    "chronicles-of-the-forgotten": "Chronicles of the Forgotten",
    "starseed-code-from-aura-to-infinity": "Starseed Code: From Aura to Infinity",
    "a-protopian-gambit": "A Protopian Gambit",
  };
  const files = { audio: "Audio", "audio-video": "Audio and lyric videos", video: "Lyric videos" };
  const deliveries = { download: "Digital download", usb: "USB", cd: "Standard audio CD (two-disc album set)", dvd: "DVD (player and contents to confirm)" };
  const isKnown = (options, value) => Object.hasOwn(options, value);

  const order = document.querySelector("#music-order");
  if (order) {
    const summary = order.querySelector("#music-order-summary");
    const packageName = order.querySelector("#music-package-name");
    const packagePrice = order.querySelector("#music-package-price");
    const fileSelect = order.querySelector("#music-file-preference");
    const deliverySelect = order.querySelector("#music-delivery-preference");
    const albumField = order.querySelector("#checkout-albums");
    const requestField = order.querySelector("#checkout-request-id");
    const buyer = order.querySelector("#checkout-buyer");
    const payments = order.querySelector("#checkout-payments");
    const paymentField = order.querySelector("#checkout-method");
    const buttons = Array.from(payments.querySelectorAll("button"));
    const status = order.querySelector("#checkout-status");
    const physical = order.querySelector("#physical-order");
    const physicalLink = order.querySelector("#physical-order-link");
    const configuredEndpoint = window.SBT_CHECKOUT_CONFIG?.appsScriptEndpoint || "";
    const endpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(configuredEndpoint)
      ? configuredEndpoint : "";
    const selectedAlbums = () => Array.from(order.querySelectorAll('input[data-music-album]:checked'))
      .map((input) => input.value).filter((value) => isKnown(albums, value));
    const newRequestId = () => {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const value = Math.floor(Math.random() * 16);
        return (char === "x" ? value : (value & 3) | 8).toString(16);
      });
    };
    if (endpoint) order.action = endpoint;
    let previousSelection = "";
    const update = () => {
      const selected = selectedAlbums();
      const isDigital = deliverySelect.value === "download";
      const price = [0, 20, 35, 45, 55][selected.length];
      albumField.value = selected.join(",");
      const selection = JSON.stringify([selected, fileSelect.value, deliverySelect.value, order.elements.buyerName.value, order.elements.buyerEmail.value]);
      if (!requestField.value || selection !== previousSelection) requestField.value = newRequestId();
      previousSelection = selection;
      packageName.textContent = selected.length ? `${selected.length}-album ${selected.length === 1 ? "purchase" : "bundle"}` : "Choose your albums";
      packagePrice.textContent = selected.length ? `$${price}` : "—";
      summary.textContent = selected.length
        ? `${selected.map((value) => albums[value]).join(" + ")}. ${isDigital ? "Digital delivery included." : "Media and delivery cost to be confirmed."}`
        : "Tick albums above to see your package total.";
      buyer.hidden = !isDigital;
      buyer.disabled = !isDigital;
      payments.hidden = !isDigital;
      physical.hidden = isDigital;
      status.hidden = !isDigital;
      buttons.forEach((button) => { button.disabled = !selected.length || !endpoint || !isDigital; });
      status.textContent = !endpoint
        ? "Checkout is being connected. Payments are not open yet."
        : selected.length ? "Choose Stripe or PayPal to continue to secure payment." : "Choose at least one album to continue.";
      const params = new URLSearchParams({ catalogue: "music", music: selected.join(","), format: fileSelect.value, delivery: deliverySelect.value });
      physicalLink.href = `contact.html?${params.toString()}#contact-form-title`;
    };
    order.addEventListener("change", update);
    document.querySelectorAll("[data-select-album]").forEach((link) => {
      link.addEventListener("click", () => {
        order.querySelectorAll('input[data-music-album]').forEach((input) => {
          input.checked = input.value === link.dataset.selectAlbum;
        });
        deliverySelect.value = "download";
        update();
      });
    });
    order.addEventListener("submit", (event) => {
      const method = event.submitter?.value;
      if (!endpoint || !selectedAlbums().length || deliverySelect.value !== "download" || !["stripe", "paypal"].includes(method)) {
        event.preventDefault();
        if (deliverySelect.value === "download") status.textContent = !endpoint
          ? "The payment connection still needs to be completed. No order or payment has been submitted."
          : "Choose your albums, then choose Stripe or PayPal.";
        return;
      }
      paymentField.value = method;
      order.setAttribute("aria-busy", "true");
      status.textContent = `Opening ${method === "stripe" ? "Stripe" : "PayPal"} checkout…`;
      buttons.forEach((button) => { button.disabled = true; });
    });
    window.addEventListener("pageshow", () => { order.removeAttribute("aria-busy"); update(); });
    update();
  }

  const enquiry = document.querySelector('form input[name="form_type"][value="enquiry"]')?.form;
  if (!enquiry) return;
  const params = new URLSearchParams(window.location.search);
  const selected = [...new Set((params.get("music") || "").split(","))]
    .filter((value) => isKnown(albums, value));
  const category = params.get("catalogue");
  if (!selected.length && !["music", "custom", "writing"].includes(category)) return;

  const topic = enquiry.querySelector('select[name="topic"]');
  const message = enquiry.querySelector('textarea[name="message"]');
  if (topic) topic.value = "Digital downloads or catalogue";
  if (!message || message.value.trim()) return;

  const lines = [];
  if (selected.length) {
    lines.push("I'd like to arrange an order for:", ...selected.map((value) => `- ${albums[value]}`));
    const format = params.get("format");
    const delivery = params.get("delivery");
    if (isKnown(files, format)) lines.push(`\nFiles: ${files[format]}`);
    if (isKnown(deliveries, delivery)) lines.push(`Delivery preference: ${deliveries[delivery]}`);
    lines.push("\nPlease confirm the available files, total price, payment and delivery arrangements.");
  } else if (category === "writing") {
    lines.push("I'd like to enquire about Luke's written work or research collection.", "\nThe subject or material I'm interested in is:");
  } else if (category === "custom") {
    lines.push("I'd like to enquire about individual songs, a larger music archive or a custom selection.", "\nWhat I have in mind:");
  } else {
    lines.push("I'd like to enquire about I C. Infinity music.", "\nAlbums, files or delivery options I'm interested in:");
  }
  message.value = lines.join("\n");
})();
