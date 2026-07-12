import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ObjectStorage, PresignedUpload } from './object-storage.js';

export interface UploadTokenPayload {
  op: 'put' | 'get';
  key: string;
  mime: string;
  exp: number;
}

/**
 * Файловый драйвер. «Presigned URL» — PUT на наш собственный эндпоинт
 * /api/uploads/:token c HMAC-подписанным токеном (ключ, mime, срок).
 */
export class FsObjectStorage implements ObjectStorage {
  private readonly baseDir: string;

  constructor(
    baseDir: string,
    private readonly apiPublicUrl: string,
    private readonly secret: string,
  ) {
    // Абсолютный путь обязателен: проверка выхода за baseDir сравнивает абсолютные пути
    this.baseDir = path.resolve(baseDir);
  }

  private filePath(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(this.baseDir, safe);
    if (!full.startsWith(path.resolve(this.baseDir) + path.sep) && full !== path.resolve(this.baseDir)) {
      // после normalize ключи вида ../../etc не должны покидать baseDir
      throw new Error(`недопустимый ключ хранилища: ${key}`);
    }
    return full;
  }

  signToken(payload: UploadTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifyToken(token: string): UploadTokenPayload | null {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', this.secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as UploadTokenPayload;
      if (typeof payload.key !== 'string' || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async presignPut(key: string, mime: string, ttlSec: number): Promise<PresignedUpload> {
    const exp = Date.now() + ttlSec * 1000;
    const token = this.signToken({ op: 'put', key, mime, exp });
    return {
      url: `${this.apiPublicUrl}/api/uploads/${token}`,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      expiresAt: new Date(exp).toISOString(),
    };
  }

  async presignGet(key: string, ttlSec: number): Promise<string> {
    const exp = Date.now() + ttlSec * 1000;
    const token = this.signToken({ op: 'get', key, mime: 'application/octet-stream', exp });
    return `${this.apiPublicUrl}/api/uploads/${token}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.filePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.filePath(key));
  }

  async write(key: string, data: Buffer, _mime: string): Promise<void> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true });
  }
}
