import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) поверх HOTP (RFC 4226) на node:crypto — без внешних зависимостей.
 * Алгоритм SHA-1, шаг 30 с, 6 цифр (совместимо с Google Authenticator и аналогами).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // RFC 4648 base32
const PERIOD_SEC = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`недопустимый символ base32: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226): код по ключу и счётчику. */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const buf = Buffer.alloc(8);
  // 64-битный счётчик big-endian (для наших диапазонов старшие 32 бита — 0)
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Текущий код для base32-секрета (для тестов и генерации). */
export function totpNow(secret: string, atMs = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / PERIOD_SEC);
  return hotp(base32Decode(secret), counter);
}

/** Проверка кода с окном ±window шагов (компенсация рассинхрона часов). */
export function verifyTotp(secret: string, code: string, window = 1, atMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / PERIOD_SEC);
  const target = Buffer.from(code);
  for (let w = -window; w <= window; w++) {
    const candidate = Buffer.from(hotp(key, counter + w));
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) return true;
  }
  return false;
}

/** otpauth-URI для QR-кода в приложении-аутентификаторе. */
export function totpAuthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
