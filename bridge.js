(() => {
  window.addEventListener("guptasutra-set-text", (e) => {
    const tb = document.querySelector('footer div[role="textbox"]');
    if (!tb) return;

    tb.focus();

    const ed = tb.__lexicalEditor;
    if (ed && ed._commands) {
      for (const [key] of ed._commands) {
        if (key && key.type === "CLEAR_EDITOR_COMMAND") {
          ed.dispatchCommand(key, undefined);
          break;
        }
      }
    }

    document.execCommand("insertText", false, e.detail.text);
    tb.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));

    window.dispatchEvent(new CustomEvent("guptasutra-text-ready"));
  });
})();
