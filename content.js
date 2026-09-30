(() => {
  console.log("[Guptasutra] Content script loaded.");

  const MAX_SAFE_BYTE_LENGTH = 60000;
  const SVG_LOCK_CLOSED = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
  const SVG_LOCK_OPEN = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-5h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75-.14.54.18 1.08.72 1.23.53.14 1.08-.18 1.23-.72.35-1.36 1.58-2.26 2.89-2.26 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`;

  const SAFE_EMOJIS = [
    "👍", "👌", "🤝", "☕", "✨", "🎯", "🚀", "💡", "📌", "📝", "✅", "⚡", "🫡", "🙌", "👋", "🔥", "💯", "🍀"
  ];

  let state = {
    passphrase: "",
    enabled: true,
    coverText: "random_emoji"
  };

  let isBypassingSend = false;
  let scanTimeout = null;
  let alertTimeout = null;

  chrome.storage.local.get(["passphrase", "enabled", "coverText"], (stored) => {
    if (stored.passphrase !== undefined) state.passphrase = stored.passphrase;
    if (stored.enabled !== undefined) state.enabled = stored.enabled;
    if (stored.coverText !== undefined) state.coverText = stored.coverText;
    renderRailButton();
    scheduleScan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.passphrase) state.passphrase = changes.passphrase.newValue || "";
    if (changes.enabled) state.enabled = Boolean(changes.enabled.newValue);
    if (changes.coverText) state.coverText = changes.coverText.newValue || "random_emoji";
    updateRailButtonUI();
    reprocessAllMessages();
  });

  function resolveCoverText() {
    if (state.coverText === "random_emoji") {
      return SAFE_EMOJIS[Math.floor(Math.random() * SAFE_EMOJIS.length)];
    }
    return state.coverText || "Sounds good, let us meet tomorrow.";
  }

  function flashRailAlert(text) {
    const btn = document.getElementById("guptasutra-rail-btn");
    if (!btn) return;

    clearTimeout(alertTimeout);
    btn.className = "guptasutra-rail-btn error";
    btn.setAttribute("title", `Guptasutra: ${text}`);

    alertTimeout = setTimeout(() => {
      updateRailButtonUI();
    }, 3500);
  }

  function renderRailButton() {
    document.getElementById("guptasutra-floating-toggle")?.remove();

    const settingsBtn = document.querySelector('button[aria-label="Settings"], [aria-label="Settings"]');
    if (!settingsBtn) return;

    const targetWrapper = settingsBtn.closest("span")?.parentElement || settingsBtn.parentElement;
    const parentContainer = targetWrapper.parentElement;
    if (!parentContainer) return;

    let btn = document.getElementById("guptasutra-rail-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "guptasutra-rail-btn";
      btn.className = "guptasutra-rail-btn";
      btn.addEventListener("click", () => {
        state.enabled = !state.enabled;
        chrome.storage.local.set({ enabled: state.enabled });
        updateRailButtonUI();
      });
      parentContainer.insertBefore(btn, targetWrapper);
    } else if (btn.parentElement !== parentContainer) {
      parentContainer.insertBefore(btn, targetWrapper);
    }

    updateRailButtonUI();
  }

  function updateRailButtonUI() {
    const btn = document.getElementById("guptasutra-rail-btn");
    if (!btn) return;

    if (!state.passphrase) {
      btn.className = "guptasutra-rail-btn warning";
      btn.innerHTML = SVG_LOCK_OPEN;
      btn.setAttribute("title", "Guptasutra: Key Missing (Configure in popup)");
      btn.setAttribute("aria-label", "Guptasutra: Key Missing");
      return;
    }

    if (state.enabled) {
      btn.className = "guptasutra-rail-btn active";
      btn.innerHTML = SVG_LOCK_CLOSED;
      btn.setAttribute("title", "Guptasutra: ON (Click to disable)");
      btn.setAttribute("aria-label", "Guptasutra: ON");
    } else {
      btn.className = "guptasutra-rail-btn";
      btn.innerHTML = SVG_LOCK_OPEN;
      btn.setAttribute("title", "Guptasutra: OFF (Click to enable)");
      btn.setAttribute("aria-label", "Guptasutra: OFF");
    }
  }

  async function dispatchEncryptedMessage(composer, rawText) {
    try {
      const cover = resolveCoverText();
      const encrypted = await GuptasutraCrypto.encrypt(rawText, state.passphrase);
      const stegoMessage = GuptasutraStego.embed(cover, encrypted);

      const byteLength = new TextEncoder().encode(stegoMessage).length;
      if (byteLength > MAX_SAFE_BYTE_LENGTH) {
        isBypassingSend = false;
        flashRailAlert("Too Large: Exceeds 60KB");
        return;
      }

      isBypassingSend = true;
      const success = await GuptasutraAdapter.setComposerText(composer, stegoMessage);
      if (!success) {
        isBypassingSend = false;
        flashRailAlert("Insertion Failed");
        return;
      }

      const composerText = composer.textContent || "";
      if (!composerText.includes(GuptasutraStego.MAGIC_HEADER)) {
        isBypassingSend = false;
        flashRailAlert("Payload Missing: Aborted");
        console.error("[Guptasutra] Assertion failed: Magic header absent before dispatch.");
        return;
      }

      const sendBtn = await GuptasutraAdapter.waitForSendButton(1000);
      if (sendBtn) {
        sendBtn.click();
      }
      isBypassingSend = false;
    } catch (err) {
      isBypassingSend = false;
      flashRailAlert("Encryption Error");
      console.error("[Guptasutra] Encryption error:", err);
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

    await dispatchEncryptedMessage(composer, rawText);
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

    await dispatchEncryptedMessage(composer, rawText);
  }

  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("click", handleClick, true);

  async function processBubble(bubble) {
    if (bubble.dataset.guptasutraProcessed === "true") return;

    let rawContent = bubble.textContent || "";
    if (!rawContent.includes(GuptasutraStego.MAGIC_HEADER)) {
      return;
    }

    const readMoreBtn = Array.from(bubble.querySelectorAll('[role="button"], span, div')).find(
      (el) => el.innerText?.trim() === "Read more"
    );
    if (readMoreBtn) {
      readMoreBtn.click();
      await new Promise((r) => setTimeout(r, 60));
      rawContent = bubble.textContent || "";
    }

    const extracted = GuptasutraStego.extract(rawContent);
    if (!extracted) return;

    bubble.dataset.guptasutraProcessed = "true";
    if (readMoreBtn) {
      readMoreBtn.style.display = "none";
    }

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
        if (el.id === "guptasutra-rail-btn" || el.classList.contains("guptasutra-badge")) {
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
      renderRailButton();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    renderRailButton();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      renderRailButton();
    }, { once: true });
  }
})();
