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

  function setComposerText(inputNode, text) {
    inputNode.focus();

    inputNode.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        code: "KeyA",
        keyCode: 65,
        which: 65,
        ctrlKey: true,
        bubbles: true
      })
    );

    document.execCommand("insertText", false, text);
    inputNode.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  }

  root.GuptasutraAdapter = {
    getComposerInput,
    getSendButton,
    waitForSendButton,
    getMessageBubbles,
    setComposerText
  };
})();
