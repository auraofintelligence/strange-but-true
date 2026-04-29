const toggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector("#nav-links");
const checkoutModal = document.querySelector("#checkout-modal");
const checkoutTitle = document.querySelector("#checkout-modal-title");
const checkoutPrice = document.querySelector("#checkout-price");
const checkoutDelivery = document.querySelector("#checkout-delivery");
const paymentLink = document.querySelector("#payment-link");
const agentModal = document.querySelector("#agent-modal");
const upsellCopy = document.querySelector("#upsell-copy");
const voiceButton = document.querySelector("[data-voice-form]");
const speakButton = document.querySelector("[data-speak-form]");
const voiceStatus = document.querySelector("[data-voice-status]");
const voiceTarget = document.querySelector("[data-voice-target]");
const guideTitle = document.querySelector("[data-guide-title]");
const guideResponse = document.querySelector("[data-guide-response]");
const guideLink = document.querySelector("[data-guide-link]");

if (toggle && navLinks) {
  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll("[data-checkout-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const product = button.getAttribute("data-product") || "Selected download";
    const price = button.getAttribute("data-price") || "Price to be confirmed";
    const payment = button.getAttribute("data-payment") || "https://example.com/replace-with-payment-link";
    const delivery = button.getAttribute("data-delivery") || "Downloads are delivered after payment confirmation.";

    if (checkoutTitle) checkoutTitle.textContent = product;
    if (checkoutPrice) checkoutPrice.textContent = price;
    if (checkoutDelivery) checkoutDelivery.textContent = delivery;
    if (upsellCopy) {
      const supporterSelected = product.toLowerCase().includes("supporter");
      upsellCopy.textContent = supporterSelected
        ? "You are already choosing the supporter bundle. The useful next step is referral or custom help."
        : "If you are buying a single item, the supporter bundle may be better value once it is live.";
    }
    if (paymentLink) {
      const isPlaceholderPayment = payment.includes("example.com") || payment.includes("replace-with");
      const isFree = price.toLowerCase() === "free";
      paymentLink.href = isPlaceholderPayment ? "contact.html" : payment.startsWith("http") ? payment : payment;
      paymentLink.removeAttribute("target");
      paymentLink.removeAttribute("rel");

      if (!isPlaceholderPayment && payment.startsWith("http")) {
        paymentLink.setAttribute("target", "_blank");
        paymentLink.setAttribute("rel", "noopener noreferrer");
      }

      paymentLink.textContent = isFree ? "Get the free sample" : isPlaceholderPayment ? "Payment link coming soon" : "Pay by card";
    }

    if (checkoutModal instanceof HTMLDialogElement) {
      checkoutModal.showModal();
    }
  });
});

if (checkoutModal instanceof HTMLDialogElement) {
  checkoutModal.addEventListener("click", (event) => {
    if (event.target === checkoutModal) {
      checkoutModal.close();
    }
  });
}

document.querySelectorAll("[data-share]").forEach((button) => {
  button.addEventListener("click", async () => {
    const shareUrl = button.getAttribute("data-share-url") || window.location.href;
    const shareText = button.getAttribute("data-share-text") || "Strange but True: tech, art and ideas that'll actually help.";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Strange but True", text: shareText, url: shareUrl });
      } catch {
        // The user cancelled the share sheet.
      }
      return;
    }

    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    button.textContent = "Link copied";
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "index.html";
  });
});

document.querySelectorAll("[data-agent-open]").forEach((button) => {
  button.addEventListener("click", () => {
    if (agentModal instanceof HTMLDialogElement) {
      agentModal.showModal();
    }
  });
});

if (agentModal instanceof HTMLDialogElement) {
  agentModal.addEventListener("click", (event) => {
    if (event.target === agentModal) {
      agentModal.close();
    }
  });
}

const guideResponses = {
  tech: {
    title: "Start with a short enquiry.",
    response:
      "Tell Luke what you are trying to do, what device or tool is involved, and whether there is a deadline. Do not include passwords, one-time codes or private documents.",
    href: "contact.html#contact-form-title",
    label: "Send a question",
  },
  meeting: {
    title: "Request a time, then Luke confirms.",
    response:
      "Choose a preferred date and time window. This creates a meeting request only, not a confirmed calendar booking.",
    href: "contact.html#meeting-form-title",
    label: "Request a time",
  },
  downloads: {
    title: "Browse samples and bundles.",
    response:
      "Start with the free sampler, music catalogue or writing bundles. Paid download links are placeholders until the checkout provider is connected.",
    href: "downloads.html",
    label: "Open downloads",
  },
  events: {
    title: "Share the date, place and gear.",
    response:
      "For projector, sound, outdoor cinema or local event support, send the event date, location, rough audience size and what equipment you already have.",
    href: "contact.html#contact-form-title",
    label: "Ask about an event",
  },
  feedback: {
    title: "Leave a tiny field report.",
    response:
      "If Strange but True helped, say what got easier and what could be smoother next time. Short, honest notes are useful.",
    href: "feedback.html",
    label: "Leave feedback",
  },
};

document.querySelectorAll("[data-guide-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-guide-choice") || "tech";
    const item = guideResponses[key] || guideResponses.tech;

    document.querySelectorAll("[data-guide-choice]").forEach((choice) => {
      choice.classList.toggle("is-active", choice === button);
    });

    if (guideTitle) guideTitle.textContent = item.title;
    if (guideResponse) guideResponse.textContent = item.response;
    if (guideLink) {
      guideLink.href = item.href;
      guideLink.textContent = item.label;
    }
  });
});

const topButton = document.querySelector("[data-to-top]");

if (topButton) {
  const updateTopButton = () => {
    topButton.classList.toggle("is-visible", window.scrollY > 560);
  };

  updateTopButton();
  window.addEventListener("scroll", updateTopButton, { passive: true });
  topButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

function setVoiceStatus(message) {
  if (voiceStatus) voiceStatus.textContent = message;
}

if (voiceButton && voiceTarget) {
  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    setVoiceStatus("Voice dictation is not supported in this browser. Chrome is the best target for this prototype.");
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = "en-AU";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.addEventListener("start", () => {
      isListening = true;
      voiceButton.setAttribute("aria-pressed", "true");
      voiceButton.classList.add("is-listening");
      setVoiceStatus("Listening. Speak naturally; your words will be added to the message box.");
    });

    recognition.addEventListener("result", (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText.trim()) {
        const current = voiceTarget.value.trim();
        voiceTarget.value = `${current}${current ? " " : ""}${finalText.trim()}`;
      }

      if (interimText.trim()) {
        setVoiceStatus(`Listening: ${interimText.trim()}`);
      }
    });

    recognition.addEventListener("end", () => {
      isListening = false;
      voiceButton.setAttribute("aria-pressed", "false");
      voiceButton.classList.remove("is-listening");
      setVoiceStatus("Voice dictation stopped. You can edit the message before sending.");
    });

    recognition.addEventListener("error", (event) => {
      setVoiceStatus(`Voice dictation stopped: ${event.error}. Check microphone permission if needed.`);
    });

    voiceButton.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
        return;
      }

      recognition.start();
    });
  }
}

if (speakButton) {
  if (!("speechSynthesis" in window)) {
    speakButton.disabled = true;
  } else {
    speakButton.addEventListener("click", () => {
      window.speechSynthesis.cancel();
      const message = "Tell Luke what you are trying to do. A few plain words is enough. Please do not include passwords, private keys, recovery phrases, or one-time codes.";
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "en-AU";
      window.speechSynthesis.speak(utterance);
      setVoiceStatus("Reading the form prompt aloud.");
    });
  }
}

document.querySelectorAll("[data-sample-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const showcase = button.closest("[data-sample-showcase]");
    if (!showcase) return;
    const animated = showcase.classList.toggle("is-animated");
    button.setAttribute("aria-pressed", String(animated));
    button.textContent = animated ? "Animated glow" : "Calm view";
  });
});
