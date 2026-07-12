import { randomBytes } from 'node:crypto';
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
import { emailVerifications, refreshTokens, users } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { MailerService } from '../mailer/mailer.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { TokensService } from './tokens.service.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
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
    const tokens = await this.issueTokens(user.id, email);
    return { user: this.toPublic(user), ...tokens };
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
    };
  }
}
