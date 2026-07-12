import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Env } from '@avatarstudio/shared';
import { FsObjectStorage } from './fs-storage.js';
import { S3ObjectStorage } from './s3-storage.js';
import type { ObjectStorage } from './object-storage.js';

/**
 * Относительный STORAGE_FS_DIR резолвится от корня монорепо, а не от cwd:
 * api и worker запускаются из разных каталогов, но обязаны видеть одно хранилище.
 */
export function resolveStorageDir(dir: string): string {
  if (path.isAbsolute(dir)) return dir;
  let current = process.cwd();
  for (;;) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return path.join(current, dir);
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(dir);
    current = parent;
  }
}

/** Единая точка выбора драйвера — используется и api, и worker. */
export function createStorageFromEnv(env: Env): ObjectStorage {
  return env.STORAGE_DRIVER === 's3'
    ? new S3ObjectStorage(env)
    : new FsObjectStorage(resolveStorageDir(env.STORAGE_FS_DIR), env.API_PUBLIC_URL, env.JWT_SECRET);
}
