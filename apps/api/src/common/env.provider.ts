import { loadEnv, type Env } from '@avatarstudio/shared';

/** DI-токен конфигурации. Валидируется один раз при старте приложения. */
export const ENV = Symbol('ENV');

export const envProvider = {
  provide: ENV,
  useFactory: (): Env => loadEnv(),
};
