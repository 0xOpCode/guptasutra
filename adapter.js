(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  function getComposerInput() {
    return (
      document.querySelector('footer div[role="textbox"][contenteditable="true"]') ||
      document.querySelector('footer [contenteditable="true"]') ||
      document.querySelector('[data-lexical-editor="true"]')
    );
  }

  function getSendButton() {
    return document.querySelector(
      'footer button[aria-label="Send"], footer button span[data-icon*="send"]'
    )?.closest("button") || null;
  }

  async function waitForSendButton(timeoutMs = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const btn = getSendButton();
      if (btn && !btn.disabled) return btn;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  }

  function getMessageBubbles() {
    return document.querySelectorAll('div[data-id], div.message-in, div.message-out');
  }

  async function setComposerText(inputNode, text) {
    inputNode.focus();

    await new Promise((resolve) => {
      let timeout = null;
      const handler = () => {
        clearTimeout(timeout);
        window.removeEventListener("guptasutra-text-ready", handler);
        resolve();
      };

      window.addEventListener("guptasutra-text-ready", handler);
      window.dispatchEvent(new CustomEvent("guptasutra-set-text", { detail: { text } }));

      timeout = setTimeout(() => {
        window.removeEventListener("guptasutra-text-ready", handler);
        resolve();
      }, 150);
    });
  }

  root.GuptasutraAdapter = {
    getComposerInput,
    getSendButton,
    waitForSendButton,
    getMessageBubbles,
    setComposerText
  };
})();
