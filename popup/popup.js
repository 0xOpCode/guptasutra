document.addEventListener("DOMContentLoaded", () => {
  const passphraseInput = document.getElementById("passphrase");
  const togglePwBtn = document.getElementById("toggle-pw");
  const coverSelect = document.getElementById("cover-select");
  const customCoverInput = document.getElementById("custom-cover");
  const enabledToggle = document.getElementById("enabled-toggle");
  const saveBtn = document.getElementById("save-btn");
  const statusMsg = document.getElementById("status-msg");

  chrome.storage.local.get(["passphrase", "enabled", "coverText"], (data) => {
    if (data.passphrase) passphraseInput.value = data.passphrase;
    if (data.enabled !== undefined) enabledToggle.checked = data.enabled;

    if (data.coverText) {
      const options = Array.from(coverSelect.options).map((opt) => opt.value);
      if (options.includes(data.coverText)) {
        coverSelect.value = data.coverText;
        customCoverInput.classList.add("hidden");
      } else {
        coverSelect.value = "custom";
        customCoverInput.value = data.coverText;
        customCoverInput.classList.remove("hidden");
      }
    }
  });

  togglePwBtn.addEventListener("click", () => {
    passphraseInput.type = passphraseInput.type === "password" ? "text" : "password";
  });

  coverSelect.addEventListener("change", () => {
    if (coverSelect.value === "custom") {
      customCoverInput.classList.remove("hidden");
      customCoverInput.focus();
    } else {
      customCoverInput.classList.add("hidden");
    }
  });

  saveBtn.addEventListener("click", () => {
    const passphrase = passphraseInput.value.trim();
    const enabled = enabledToggle.checked;

    let coverText = coverSelect.value;
    if (coverText === "custom") {
      coverText = customCoverInput.value.trim() || "Sounds good, let us meet tomorrow.";
    }

    chrome.storage.local.set({ passphrase, enabled, coverText }, () => {
      statusMsg.classList.remove("hidden");
      setTimeout(() => {
        statusMsg.classList.add("hidden");
      }, 2000);
    });
  });
});
