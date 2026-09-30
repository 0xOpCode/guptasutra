(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const ZW_CHARS = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
  const ZW_MAP = new Map(ZW_CHARS.map((char, idx) => [char, idx]));
  const MAGIC_HEADER = "\u200C\u200D\u200C\u200D\uFEFF\uFEFF";

  function encodeBytes(bytes) {
    const stream = [];
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      stream.push(ZW_CHARS[(byte >> 6) & 3]);
      stream.push(ZW_CHARS[(byte >> 4) & 3]);
      stream.push(ZW_CHARS[(byte >> 2) & 3]);
      stream.push(ZW_CHARS[byte & 3]);
    }
    return stream.join("");
  }

  function decodeBytes(rawStream, offset, byteCount) {
    const charCount = byteCount * 4;
    if (rawStream.length < offset + charCount) return null;
    const out = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      const base = offset + i * 4;
      const v0 = ZW_MAP.get(rawStream[base]);
      const v1 = ZW_MAP.get(rawStream[base + 1]);
      const v2 = ZW_MAP.get(rawStream[base + 2]);
      const v3 = ZW_MAP.get(rawStream[base + 3]);
      if (v0 === undefined || v1 === undefined || v2 === undefined || v3 === undefined) return null;
      out[i] = (v0 << 6) | (v1 << 4) | (v2 << 2) | v3;
    }
    return out;
  }

  function embed(coverText, payloadBytes) {
    const lenBytes = new Uint8Array(4);
    const dv = new DataView(lenBytes.buffer);
    dv.setUint32(0, payloadBytes.length, false);

    const lenStream = encodeBytes(lenBytes);
    const payloadStream = encodeBytes(payloadBytes);
    return coverText + MAGIC_HEADER + lenStream + payloadStream;
  }

  function extract(str) {
    if (!str) return null;
    const headerIndex = str.indexOf(MAGIC_HEADER);
    if (headerIndex === -1) return null;

    const coverText = str.slice(0, headerIndex);
    const rawStream = str.slice(headerIndex + MAGIC_HEADER.length);

    const lenBytes = decodeBytes(rawStream, 0, 4);
    if (!lenBytes) return null;

    const dv = new DataView(lenBytes.buffer);
    const payloadLen = dv.getUint32(0, false);
    if (payloadLen > 1000000) return null;

    const payload = decodeBytes(rawStream, 16, payloadLen);
    if (!payload) return null;

    return { coverText, payload };
  }

  root.GuptasutraStego = { embed, extract, MAGIC_HEADER };
})();
