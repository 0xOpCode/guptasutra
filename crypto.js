(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const PBKDF2_ITERATIONS = 100000;
  const KEY_LENGTH_BITS = 256;
  const SALT_LENGTH_BYTES = 16;
  const IV_LENGTH_BYTES = 12;

  async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const rawKey = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      rawKey,
      { name: "AES-GCM", length: KEY_LENGTH_BITS },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(plaintext, passphrase) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
    const key = await deriveKey(passphrase, salt);

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );

    const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    packed.set(salt, 0);
    packed.set(iv, salt.length);
    packed.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return packed;
  }

  async function decrypt(packedBytes, passphrase) {
    if (packedBytes.length <= SALT_LENGTH_BYTES + IV_LENGTH_BYTES) {
      throw new Error("Payload size too short");
    }

    const salt = packedBytes.slice(0, SALT_LENGTH_BYTES);
    const iv = packedBytes.slice(SALT_LENGTH_BYTES, SALT_LENGTH_BYTES + IV_LENGTH_BYTES);
    const ciphertext = packedBytes.slice(SALT_LENGTH_BYTES + IV_LENGTH_BYTES);

    const key = await deriveKey(passphrase, salt);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  root.GuptasutraCrypto = { encrypt, decrypt };
})();
