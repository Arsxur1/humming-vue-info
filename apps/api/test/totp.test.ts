import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  totpAuthUri,
  totpNow,
  verifyTotp,
} from '../src/auth/totp.js';

describe('base32', () => {
  it('кодирование/декодирование обратимо', () => {
    const buf = Buffer.from('12345678901234567890');
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it('эталон RFC 4648: секрет "12345678901234567890"', () => {
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe(
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    );
  });
});

describe('HOTP/TOTP — эталонные векторы RFC 6238 (SHA-1)', () => {
  // seed из Appendix B RFC 6238
  const key = Buffer.from('12345678901234567890');

  it('T=59 (counter=1) → 287082', () => {
    expect(hotp(key, 1)).toBe('287082');
  });

  it('T=1111111109 (counter=37037036) → 081804', () => {
    expect(hotp(key, Math.floor(1111111109 / 30))).toBe('081804');
  });

  it('T=2000000000 (counter=66666666) → 279037', () => {
    expect(hotp(key, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('totpNow совпадает с hotp на фиксированном времени', () => {
    const secret = base32Encode(key);
    expect(totpNow(secret, 59_000)).toBe('287082');
  });
});

describe('verifyTotp', () => {
  it('принимает текущий код и код в пределах окна', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpNow(secret, now), 1, now)).toBe(true);
    // код предыдущего шага (−30 c) принимается при window=1
    expect(verifyTotp(secret, totpNow(secret, now - 30_000), 1, now)).toBe(true);
  });

  it('отклоняет код вне окна и мусор', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpNow(secret, now - 120_000), 1, now)).toBe(false);
    expect(verifyTotp(secret, '000000', 1, now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', 1, now)).toBe(false);
  });
});

describe('totpAuthUri', () => {
  it('содержит issuer, secret и параметры', () => {
    const uri = totpAuthUri('JBSWY3DPEHPK3PXP', 'user@example.com', 'AvatarStudio');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=AvatarStudio');
    expect(uri).toContain('digits=6');
  });
});
