import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { moderationCases, type Db } from '@avatarstudio/db';
import type { ResolveModerationCaseDto } from '@avatarstudio/shared';
import { DB } from '../db/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';
import { MODERATION_PROVIDER, type IModerationProvider } from './moderation.provider.js';

@Injectable()
export class ModerationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MODERATION_PROVIDER) private readonly provider: IModerationProvider,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Гейт перед постановкой рендера (Этап 5): block → исключение;
   * review → исключение с созданием кейса, пока admin не одобрит этот же scriptHash.
   */
  async assertScriptAllowed(args: {
    workspaceId: string;
    projectId: string;
    scriptHash: string;
    plainText: string;
    actor: AuthenticatedUser;
  }): Promise<void> {
    const approved = await this.db.query.moderationCases.findFirst({
      where: and(
        eq(moderationCases.workspaceId, args.workspaceId),
        eq(moderationCases.scriptHash, args.scriptHash),
        eq(moderationCases.status, 'approved'),
      ),
    });
    if (approved) return; // одобрено ручной модерацией

    const result = await this.provider.check(args.plainText);
    if (result.verdict === 'allow') return;

    await this.audit.record({
      workspaceId: args.workspaceId,
      actorId: args.actor.id,
      action: result.verdict === 'block' ? 'moderation.blocked' : 'moderation.review_queued',
      target: args.projectId,
      meta: { category: result.category, scriptHash: args.scriptHash },
    });

    if (result.verdict === 'block') {
      throw new ForbiddenException({
        error: {
          code: 'CONTENT_POLICY_VIOLATION',
          message: `Скрипт нарушает правила площадки (категория: ${result.category ?? 'policy'}). Уберите недопустимый фрагмент и попробуйте снова.`,
        },
      });
    }

    // review: создаём кейс (идемпотентно по (workspace, scriptHash))
    await this.db
      .insert(moderationCases)
      .values({
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        scriptHash: args.scriptHash,
        excerpt: args.plainText.slice(0, 500),
        matchedTerm: result.matchedTerm ?? null,
        category: result.category ?? null,
      })
      .onConflictDoNothing();
    throw new ForbiddenException({
      error: {
        code: 'MODERATION_PENDING',
        message:
          'Скрипт отправлен на ручную модерацию. Администратор workspace может одобрить его в очереди модерации — после этого запустите рендер снова.',
      },
    });
  }

  async listCases(workspaceId: string, status?: 'pending' | 'approved' | 'rejected') {
    const where = status
      ? and(eq(moderationCases.workspaceId, workspaceId), eq(moderationCases.status, status))
      : eq(moderationCases.workspaceId, workspaceId);
    return this.db
      .select()
      .from(moderationCases)
      .where(where)
      .orderBy(desc(moderationCases.createdAt));
  }

  async resolve(
    workspaceId: string,
    caseId: string,
    dto: ResolveModerationCaseDto,
    actor: AuthenticatedUser,
  ) {
    const found = await this.db.query.moderationCases.findFirst({
      where: and(eq(moderationCases.id, caseId), eq(moderationCases.workspaceId, workspaceId)),
    });
    if (!found) {
      throw new NotFoundException({
        error: { code: 'CASE_NOT_FOUND', message: 'Кейс модерации не найден.' },
      });
    }
    const [updated] = await this.db
      .update(moderationCases)
      .set({
        status: dto.decision === 'approve' ? 'approved' : 'rejected',
        note: dto.note ?? null,
        reviewerId: actor.id,
        resolvedAt: new Date(),
      })
      .where(eq(moderationCases.id, caseId))
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: `moderation.case_${dto.decision}d`,
      target: caseId,
      meta: { scriptHash: found.scriptHash },
    });
    return updated;
  }
}
