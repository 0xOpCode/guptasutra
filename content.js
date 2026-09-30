(() => {
  console.log("[Guptasutra] Content script loaded.");

  let state = {
    passphrase: "",
    enabled: true,
    coverText: "Sounds good, let us meet tomorrow."
  };

  let isBypassingSend = false;
  let scanTimeout = null;

  chrome.storage.local.get(["passphrase", "enabled", "coverText"], (stored) => {
    if (stored.passphrase !== undefined) state.passphrase = stored.passphrase;
    if (stored.enabled !== undefined) state.enabled = stored.enabled;
    if (stored.coverText !== undefined) state.coverText = stored.coverText;
    renderFloatingToggle();
    scheduleScan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.passphrase) state.passphrase = changes.passphrase.newValue || "";
    if (changes.enabled) state.enabled = Boolean(changes.enabled.newValue);
    if (changes.coverText) state.coverText = changes.coverText.newValue || "Sounds good, let us meet tomorrow.";
    updateToggleUI();
    reprocessAllMessages();
  });

  function renderFloatingToggle() {
    const footer = document.querySelector("footer");
    if (!footer) return;

    footer.style.position = "relative";

    let toggle = document.getElementById("guptasutra-floating-toggle");
    if (!toggle) {
      toggle = document.createElement("div");
      toggle.id = "guptasutra-floating-toggle";
      toggle.addEventListener("click", () => {
        state.enabled = !state.enabled;
        chrome.storage.local.set({ enabled: state.enabled });
        updateToggleUI();
      });
      footer.appendChild(toggle);
    } else if (toggle.parentElement !== footer) {
      footer.appendChild(toggle);
    }
    updateToggleUI();
  }

  function updateToggleUI() {
    const toggle = document.getElementById("guptasutra-floating-toggle");
    if (!toggle) return;

    if (!state.passphrase) {
      toggle.className = "guptasutra-floating-toggle disabled";
      toggle.innerHTML = `<span>⚠️</span><span>Guptasutra: Key Missing</span>`;
      toggle.title = "Passphrase not set. Open extension popup to configure.";
      return;
    }

    if (state.enabled) {
      toggle.className = "guptasutra-floating-toggle";
      toggle.innerHTML = `<span>🔒</span><span>Guptasutra: ON</span>`;
      toggle.title = "Stealth encryption active. Click to disable.";
    } else {
      toggle.className = "guptasutra-floating-toggle disabled";
      toggle.innerHTML = `<span>🔓</span><span>Guptasutra: OFF</span>`;
      toggle.title = "Stealth encryption inactive. Click to enable.";
    }
  }

  async function handleKeydown(e) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (!state.enabled || !state.passphrase || isBypassingSend) return;

    const composer = GuptasutraAdapter.getComposerInput();
    if (!composer) return;
    if (!composer.contains(e.target) && e.target !== composer) return;

    const rawText = composer.innerText.trim();
    if (!rawText) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    try {
      const encrypted = await GuptasutraCrypto.encrypt(rawText, state.passphrase);
      const stegoMessage = GuptasutraStego.embed(state.coverText, encrypted);

      isBypassingSend = true;
      GuptasutraAdapter.setComposerText(composer, stegoMessage);

      const sendBtn = await GuptasutraAdapter.waitForSendButton(1000);
      if (sendBtn) {
        sendBtn.click();
      }
      isBypassingSend = false;
    } catch (err) {
      isBypassingSend = false;
      console.error("[Guptasutra] Encryption error:", err);
    }
  }

  async function handleClick(e) {
    if (!state.enabled || !state.passphrase || isBypassingSend) return;

    const targetSend = e.target.closest('button[aria-label="Send"], span[data-icon*="send"]');
    if (!targetSend) return;

    const composer = GuptasutraAdapter.getComposerInput();
    if (!composer) return;

    const rawText = composer.innerText.trim();
    if (!rawText) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    try {
      const encrypted = await GuptasutraCrypto.encrypt(rawText, state.passphrase);
      const stegoMessage = GuptasutraStego.embed(state.coverText, encrypted);

      isBypassingSend = true;
      GuptasutraAdapter.setComposerText(composer, stegoMessage);

      const sendBtn = await GuptasutraAdapter.waitForSendButton(1000);
      if (sendBtn) {
        sendBtn.click();
      }
      isBypassingSend = false;
    } catch (err) {
      isBypassingSend = false;
      console.error("[Guptasutra] Encryption error:", err);
    }
  }

  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("click", handleClick, true);

  async function processBubble(bubble) {
    if (bubble.dataset.guptasutraProcessed === "true") return;

    const rawContent = bubble.textContent || "";
    if (!rawContent.includes(GuptasutraStego.MAGIC_HEADER)) {
      return;
    }

    const extracted = GuptasutraStego.extract(rawContent);
    if (!extracted) return;

    bubble.dataset.guptasutraProcessed = "true";

    const badge = document.createElement("div");
    badge.className = "guptasutra-badge";

    if (!state.passphrase) {
      badge.className = "guptasutra-badge error";
      badge.innerHTML = `<span class="guptasutra-icon">🔒</span><span class="guptasutra-text">Passphrase required</span>`;
      const target = bubble.querySelector(".selectable-text") || bubble;
      target.appendChild(badge);
      return;
    }

    try {
      const plaintext = await GuptasutraCrypto.decrypt(extracted.payload, state.passphrase);
      badge.innerHTML = `<span class="guptasutra-icon">🔓</span><span class="guptasutra-text">${escapeHTML(plaintext)}</span>`;
      const target = bubble.querySelector(".selectable-text") || bubble;
      target.appendChild(badge);
    } catch (err) {
      badge.className = "guptasutra-badge error";
      badge.innerHTML = `<span class="guptasutra-icon">🔒</span><span class="guptasutra-text">Wrong passphrase</span>`;
      const target = bubble.querySelector(".selectable-text") || bubble;
      target.appendChild(badge);
    }
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function scheduleScan() {
    if (scanTimeout) return;
    scanTimeout = setTimeout(() => {
      scanTimeout = null;
      scanMessages();
    }, 250);
  }

  function scanMessages() {
    const bubbles = GuptasutraAdapter.getMessageBubbles();
    if (!bubbles.length) return;
    for (let i = 0; i < bubbles.length; i++) {
      processBubble(bubbles[i]);
    }
  }

  function reprocessAllMessages() {
    const badges = document.querySelectorAll(".guptasutra-badge");
    badges.forEach((b) => b.remove());

    const bubbles = GuptasutraAdapter.getMessageBubbles();
    bubbles.forEach((b) => {
      delete b.dataset.guptasutraProcessed;
    });

    scheduleScan();
  }

  const observer = new MutationObserver((mutations) => {
    let hasRelevantNodes = false;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.target && m.target.nodeType === 1) {
        const el = m.target;
        if (el.id === "guptasutra-floating-toggle" || el.classList.contains("guptasutra-badge")) {
          continue;
        }
      }
      if (m.addedNodes.length > 0) {
        hasRelevantNodes = true;
        break;
      }
    }

    if (hasRelevantNodes) {
      scheduleScan();
      renderFloatingToggle();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    renderFloatingToggle();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      renderFloatingToggle();
    }, { once: true });
  }
})();
