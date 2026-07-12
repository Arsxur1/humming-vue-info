import type { Env } from '@avatarstudio/shared';
import { FsObjectStorage } from './fs-storage.js';
import { S3ObjectStorage } from './s3-storage.js';
import type { ObjectStorage } from './object-storage.js';

/** Единая точка выбора драйвера — используется и api, и worker. */
export function createStorageFromEnv(env: Env): ObjectStorage {
  return env.STORAGE_DRIVER === 's3'
    ? new S3ObjectStorage(env)
    : new FsObjectStorage(env.STORAGE_FS_DIR, env.API_PUBLIC_URL, env.JWT_SECRET);
}
