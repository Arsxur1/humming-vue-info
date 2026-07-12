import { Global, Module } from '@nestjs/common';
import type { Env } from '@avatarstudio/shared';
import { ENV } from '../common/env.provider.js';
import { FsObjectStorage } from './fs-storage.js';
import { S3ObjectStorage } from './s3-storage.js';
import { OBJECT_STORAGE } from './object-storage.js';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (env: Env) =>
        env.STORAGE_DRIVER === 's3'
          ? new S3ObjectStorage(env)
          : new FsObjectStorage(env.STORAGE_FS_DIR, env.API_PUBLIC_URL, env.JWT_SECRET),
      inject: [ENV],
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
