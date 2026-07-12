import { Global, Module } from '@nestjs/common';
import type { Env } from '@avatarstudio/shared';
import { createStorageFromEnv, OBJECT_STORAGE } from '@avatarstudio/storage';
import { ENV, envProvider } from '../common/env.provider.js';

@Global()
@Module({
  providers: [
    envProvider,
    {
      provide: OBJECT_STORAGE,
      useFactory: (env: Env) => createStorageFromEnv(env),
      inject: [ENV],
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
