import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Env, LoginDto, RegisterDto } from '@avatarstudio/shared';
import { ENV } from '../common/env.provider.js';
import { DB, type Db } from '../db/client.js';
import { emailVerifications, passwordResets, refreshTokens, users } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { MailerService } from '../mailer/mailer.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { TokensService } from './tokens.service.js';
import { generateTotpSecret, totpAuthUri, verifyTotp } from './totp.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser } & AuthTokens> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      throw new ConflictException({
        error: {
          code: 'EMAIL_TAKEN',
          message: 'Этот e-mail уже зарегистрирован. Войдите или восстановите пароль.',
        },
      });
    }

    const passwordHash = await hashPassword(dto.password);
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash, name: dto.name })
      .returning();
    if (!user) throw new Error('insert users: пустой результат');

    const verifyToken = randomBytes(32).toString('base64url');
    await this.db.insert(emailVerifications).values({
      token: verifyToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });
    await this.mailer.send({
      to: email,
      subject: 'AvatarStudio: подтвердите e-mail',
      body: `Токен подтверждения: ${verifyToken}`,
    });

    await this.audit.record({ actorId: user.id, action: 'user.registered', target: user.id });

    const tokens = await this.issueTokens(user.id, email);
    return { user: this.toPublic(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser } & AuthTokens> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    const ok = user && (await verifyPassword(dto.password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный e-mail или пароль. Проверьте данные и попробуйте ещё раз.',
        },
      });
    }

    // 2FA: если включена — обязателен корректный TOTP-код
    if (user.mfaEnabledAt && user.mfaSecret) {
      if (!dto.totp) {
        throw new UnauthorizedException({
          error: {
            code: 'TWO_FACTOR_REQUIRED',
            message: 'Введите 6-значный код из приложения-аутентификатора.',
          },
        });
      }
      if (!verifyTotp(user.mfaSecret, dto.totp)) {
        throw new UnauthorizedException({
          error: { code: 'INVALID_2FA_CODE', message: 'Неверный код 2FA. Попробуйте ещё раз.' },
        });
      }
    }

    const tokens = await this.issueTokens(user.id, email);
    return { user: this.toPublic(user), ...tokens };
  }

  // ---------- Сброс пароля (FR-1.1) ----------

  /** Запрос сброса. Всегда 200 без раскрытия факта существования аккаунта. */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) return; // не раскрываем, есть ли такой e-mail

    const token = randomBytes(32).toString('base64url');
    await this.db.insert(passwordResets).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 час
    });
    await this.mailer.send({
      to: email,
      subject: 'AvatarStudio: сброс пароля',
      body: `Токен сброса пароля (действует 1 час): ${token}\nЕсли вы не запрашивали сброс — проигнорируйте это письмо.`,
    });
    await this.audit.record({ actorId: user.id, action: 'user.password_reset_requested' });
  }

  /** Установка нового пароля по токену; все сессии пользователя завершаются. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const row = await this.db.query.passwordResets.findFirst({
      where: and(
        eq(passwordResets.tokenHash, sha256(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    });
    if (!row) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Ссылка сброса недействительна или устарела. Запросите новую.',
        },
      });
    }
    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));
      await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
      // Безопасность: гасим все активные refresh-токены
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    });
    await this.audit.record({ actorId: row.userId, action: 'user.password_reset' });
  }

  // ---------- 2FA / TOTP (FR-1.1) ----------

  /** Шаг 1: генерируем секрет (ещё не активен) и возвращаем otpauth-URI для QR. */
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.requireUser(userId);
    if (user.mfaEnabledAt) {
      throw new BadRequestException({
        error: { code: 'TWO_FACTOR_ALREADY_ENABLED', message: '2FA уже включена.' },
      });
    }
    const secret = generateTotpSecret();
    await this.db.update(users).set({ mfaSecret: secret }).where(eq(users.id, userId));
    return { secret, otpauthUri: totpAuthUri(secret, user.email, this.env.TOTP_ISSUER) };
  }

  /** Шаг 2: подтверждаем код и активируем 2FA. */
  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (user.mfaEnabledAt) {
      throw new BadRequestException({
        error: { code: 'TWO_FACTOR_ALREADY_ENABLED', message: '2FA уже включена.' },
      });
    }
    if (!user.mfaSecret) {
      throw new BadRequestException({
        error: {
          code: 'TWO_FACTOR_NOT_SET_UP',
          message: 'Сначала запросите настройку 2FA (setup), затем подтвердите код.',
        },
      });
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new BadRequestException({
        error: { code: 'INVALID_2FA_CODE', message: 'Неверный код. Проверьте время на устройстве.' },
      });
    }
    await this.db.update(users).set({ mfaEnabledAt: new Date() }).where(eq(users.id, userId));
    await this.audit.record({ actorId: userId, action: 'user.2fa_enabled' });
  }

  /** Отключение 2FA (требует действующий код). */
  async disableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.mfaEnabledAt || !user.mfaSecret) {
      throw new BadRequestException({
        error: { code: 'TWO_FACTOR_NOT_ENABLED', message: '2FA не включена.' },
      });
    }
    if (!verifyTotp(user.mfaSecret, code)) {
      throw new BadRequestException({
        error: { code: 'INVALID_2FA_CODE', message: 'Неверный код 2FA.' },
      });
    }
    await this.db
      .update(users)
      .set({ mfaSecret: null, mfaEnabledAt: null })
      .where(eq(users.id, userId));
    await this.audit.record({ actorId: userId, action: 'user.2fa_disabled' });
  }

  private async requireUser(userId: string): Promise<typeof users.$inferSelect> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден. Войдите заново.' },
      });
    }
    return user;
  }

  /** Ротация: старый refresh-токен отзывается, выдаётся новая пара. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = TokensService.hashRefreshToken(refreshToken);
    const row = await this.db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    });
    if (!row) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Сессия истекла или отозвана. Войдите заново.',
        },
      });
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Сессия недействительна. Войдите заново.' },
      });
    }
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = TokensService.hashRefreshToken(refreshToken);
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async verifyEmail(token: string): Promise<void> {
    const row = await this.db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.token, token),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, new Date()),
      ),
    });
    if (!row) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'Ссылка подтверждения недействительна или устарела. Запросите новое письмо.',
        },
      });
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ usedAt: new Date() })
        .where(eq(emailVerifications.token, token));
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, row.userId));
    });
    await this.audit.record({ actorId: row.userId, action: 'user.email_verified' });
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'USER_NOT_FOUND', message: 'Пользователь не найден. Войдите заново.' },
      });
    }
    return this.toPublic(user);
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = await this.tokens.signAccessToken({ sub: userId, email });
    const { token: refreshToken, tokenHash } = this.tokens.generateRefreshToken();
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SEC * 1000),
    });
    return { accessToken, refreshToken };
  }

  private toPublic(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerifiedAt !== null,
      twoFactorEnabled: user.mfaEnabledAt !== null,
    };
  }
}
