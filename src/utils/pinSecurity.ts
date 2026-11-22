/**
 * Tiện ích bảo mật Mã cá nhân 6 số (PIN)
 * Chỉ lưu trữ mã băm SHA-256 (kèm salt theo UID), tuyệt đối không lưu mã PIN gốc.
 */

export const PIN_LENGTH = 6;

export function sanitizePinInput(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export function isValidPersonalPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Hàm băm dự phòng thuần JS (chỉ dùng nếu trình duyệt không hỗ trợ crypto.subtle trong ngữ cảnh không bảo mật)
 */
function fallbackHashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fb_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function hashPersonalPin(uid: string, pin: string): Promise<string> {
  const cleanUid = (uid || '').trim();
  const cleanPin = sanitizePinInput(pin);
  if (!cleanUid || !isValidPersonalPin(cleanPin)) {
    throw new Error('Mã cá nhân phải gồm đúng 6 chữ số.');
  }

  const payload = `HanhThucLuc::PIN::v1::${cleanUid}::${cleanPin}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    const bytes = Array.from(new Uint8Array(digest));
    return `sha256_${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  return fallbackHashString(payload);
}

export async function verifyPersonalPin(
  uid: string,
  pin: string,
  expectedHash?: string | null
): Promise<boolean> {
  if (!expectedHash || !isValidPersonalPin(pin)) return false;
  const computed = await hashPersonalPin(uid, pin);
  return computed === expectedHash;
}
