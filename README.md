# Guptasutra

Stealth end-to-end encryption extension for web chat applications using zero-width steganography and AES-256-GCM.

## Architecture

- **Cryptographic Primitives**: AES-256-GCM with PBKDF2 key derivation (SHA-256, 100,000 iterations), unique 16-byte salt, and 12-byte IV per message.
- **Steganographic Transport**: Encodes ciphertext into a base-4 alphabet of zero-width non-printing Unicode characters (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`) appended to configurable decoy cover sentences.
- **Framing**: Uses a 6-character sync header (`\u200C\u200D\u200C\u200D\uFEFF\uFEFF`) and a 32-bit big-endian length prefix to isolate payload bytes from chat timestamps, emojis, and status ticks.
- **DOM Integration**: In-place mutation observer for instant decryption badges and Lexical editor composer hooks.

## Installation

1. Clone repository.
2. Open `chrome://extensions` in Chromium-based browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the root directory.
5. Set shared secret passphrase in the popup dialog.
