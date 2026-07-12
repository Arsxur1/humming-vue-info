import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { renderJobs, shareLinks, workspaceMembers, type Db } from '@avatarstudio/db';
import type { CreateShareDto, Env } from '@avatarstudio/shared';
import { OBJECT_STORAGE, type ObjectStorage } from '@avatarstudio/storage';
import { DB } from '../db/client.js';
import { ENV } from '../common/env.provider.js';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';

const DOWNLOAD_TTL_SEC = 3600;

@Injectable()
export class SharesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Ссылка на готовый рендер: public / password / members, срок жизни (FR-1.6). */
  async create(
    workspaceId: string,
    jobId: string,
    dto: CreateShareDto,
    actor: AuthenticatedUser,
  ) {
    const job = await this.db.query.renderJobs.findFirst({
      where: and(eq(renderJobs.id, jobId), eq(renderJobs.workspaceId, workspaceId)),
    });
    if (!job) {
      throw new NotFoundException({
        error: { code: 'RENDER_NOT_FOUND', message: 'Рендер-джоб не найден.' },
      });
    }
    if (job.status !== 'done' || !job.outputKey) {
      throw new BadRequestException({
        error: {
          code: 'RENDER_NOT_READY',
          message: 'Видео ещё не готово — дождитесь завершения рендера и создайте ссылку снова.',
        },
      });
    }

    const token = randomBytes(24).toString('base64url');
    const [link] = await this.db
      .insert(shareLinks)
      .values({
        token,
        jobId,
        workspaceId,
        visibility: dto.visibility,
        passwordHash: dto.password ? await hashPassword(dto.password) : null,
        expiresAt: dto.ttlHours ? new Date(Date.now() + dto.ttlHours * 3600 * 1000) : null,
        createdBy: actor.id,
      })
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'share.created',
      target: jobId,
      meta: { visibility: dto.visibility, ttlHours: dto.ttlHours ?? null },
    });
    return {
      id: link!.id,
      token,
      url: `${this.env.API_PUBLIC_URL}/api/share/${token}`,
      visibility: link!.visibility,
      expiresAt: link!.expiresAt,
    };
  }

  async revoke(workspaceId: string, shareId: string, actor: AuthenticatedUser) {
    const [updated] = await this.db
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(shareLinks.id, shareId),
          eq(shareLinks.workspaceId, workspaceId),
          isNull(shareLinks.revokedAt),
        ),
      )
      .returning();
    if (!updated) {
      throw new NotFoundException({
        error: { code: 'SHARE_NOT_FOUND', message: 'Ссылка не найдена или уже отозвана.' },
      });
    }
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'share.revoked',
      target: shareId,
    });
    return { revoked: true };
  }

  /** Публичная информация о ссылке (без выдачи видео). */
  async info(token: string) {
    const link = await this.requireActiveLink(token);
    return {
      visibility: link.visibility,
      requiresPassword: link.visibility === 'password',
      requiresAuth: link.visibility === 'members',
      expiresAt: link.expiresAt,
    };
  }

  /** Доступ к видео: проверка пароля/членства → presigned-ссылка на скачивание. */
  async access(token: string, password: string | undefined, user: AuthenticatedUser | null) {
    const link = await this.requireActiveLink(token);

    if (link.visibility === 'password') {
      const ok = password && link.passwordHash && (await verifyPassword(password, link.passwordHash));
      if (!ok) {
        throw new ForbiddenException({
          error: { code: 'WRONG_SHARE_PASSWORD', message: 'Неверный пароль ссылки.' },
        });
      }
    }
    if (link.visibility === 'members') {
      if (!user) {
        throw new UnauthorizedException({
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Ссылка доступна только участникам workspace — войдите в аккаунт.',
          },
        });
      }
      const membership = await this.db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, link.workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      });
      if (!membership) {
        throw new ForbiddenException({
          error: {
            code: 'NOT_A_MEMBER',
            message: 'Вы не участник workspace, которому принадлежит это видео.',
          },
        });
      }
    }

    const job = await this.db.query.renderJobs.findFirst({
      where: eq(renderJobs.id, link.jobId),
    });
    if (!job?.outputKey) {
      throw new GoneException({
        error: { code: 'VIDEO_UNAVAILABLE', message: 'Видео больше недоступно.' },
      });
    }
    return {
      downloadUrl: await this.storage.presignGet(job.outputKey, DOWNLOAD_TTL_SEC),
      durationMs: job.durationMs,
    };
  }

  private async requireActiveLink(token: string) {
    const link = await this.db.query.shareLinks.findFirst({
      where: eq(shareLinks.token, token),
    });
    if (!link || link.revokedAt) {
      throw new NotFoundException({
        error: { code: 'SHARE_NOT_FOUND', message: 'Ссылка не существует или отозвана.' },
      });
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        error: {
          code: 'SHARE_EXPIRED',
          message: 'Срок действия ссылки истёк. Попросите владельца создать новую.',
        },
      });
    }
    return link;
  }
}
