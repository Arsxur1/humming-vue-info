import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password (scrypt)', () => {
  it('хеш проходит проверку с верным паролем', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('неверный пароль отклоняется', async () => {
    const hash = await hashPassword('password-one');
    expect(await verifyPassword('password-two', hash)).toBe(false);
  });

  it('одинаковые пароли дают разные хеши (соль)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });

  it('битый формат хеша не роняет проверку', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$something$else$here$a$b')).toBe(false);
  });
});
