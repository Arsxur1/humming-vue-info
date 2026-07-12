/**
 * Единый контракт хранилища (CLAUDE.md: S3-совместимое, presigned uploads).
 * Реализации: S3/MinIO (prod/dev с docker) и fs (тесты, окружения без S3).
 * Бизнес-логика не знает, какой драйвер под капотом.
 */

export interface PresignedUpload {
  /** Куда клиент делает PUT с телом файла. */
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface ObjectStorage {
  presignPut(key: string, mime: string, ttlSec: number): Promise<PresignedUpload>;
  exists(key: string): Promise<boolean>;
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer, mime: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
