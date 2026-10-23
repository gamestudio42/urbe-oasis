const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    const n = (a << 16) | (b << 8) | c;
    chunk += ALPHABET[(n >>> 18) & 63];
    chunk += ALPHABET[(n >>> 12) & 63];
    chunk += i + 1 < bytes.length ? ALPHABET[(n >>> 6) & 63] : '=';
    chunk += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
    if (chunk.length >= 4096) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length % 4 !== 0) throw new Error('Invalid base64 length');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - padding);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (decode(clean, i) << 18) |
      (decode(clean, i + 1) << 12) |
      ((clean[i + 2] === '=' ? 0 : decode(clean, i + 2)) << 6) |
      (clean[i + 3] === '=' ? 0 : decode(clean, i + 3));
    if (o < out.length) out[o++] = (n >>> 16) & 0xff;
    if (o < out.length) out[o++] = (n >>> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

function decode(text: string, i: number): number {
  const v = LOOKUP[text.charCodeAt(i)] ?? -1;
  if (v < 0) throw new Error(`Invalid base64 character at ${i}`);
  return v;
}

export function int32ToBytes(data: Int32Array): Uint8Array {
  const out = new Uint8Array(data.length * 4);
  for (let i = 0; i < data.length; i++) {
    const v = data[i] as number;
    out[i * 4] = v & 0xff;
    out[i * 4 + 1] = (v >>> 8) & 0xff;
    out[i * 4 + 2] = (v >>> 16) & 0xff;
    out[i * 4 + 3] = (v >>> 24) & 0xff;
  }
  return out;
}

export function bytesToInt32(bytes: Uint8Array): Int32Array {
  if (bytes.length % 4 !== 0) throw new Error('Invalid Int32 byte length');
  const out = new Int32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] =
      (bytes[i * 4] as number) |
      ((bytes[i * 4 + 1] as number) << 8) |
      ((bytes[i * 4 + 2] as number) << 16) |
      ((bytes[i * 4 + 3] as number) << 24);
  }
  return out;
}
