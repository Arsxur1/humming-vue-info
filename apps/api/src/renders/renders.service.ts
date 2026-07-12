import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  creditCost,
  estimateSpeechDurationMs,
  type CreateRenderJobDto,
} from '@avatarstudio/shared';
import {
  finalizeRenderJob,
  InsufficientCreditsError,
  recordRenderEvent,
  renderJobEvents,
  renderJobs,
  reserveCredits,
  scenes,
  type Db,
  type RenderEventPublisher,
} from '@avatarstudio/db';
import { compileToPlainText, safeParse } from '@avatarstudio/director-markup';
import { scriptHash } from '@avatarstudio/shared/scene-hash';
import { OBJECT_STORAGE, type ObjectStorage } from '@avatarstudio/storage';
import { DB } from '../db/client.js';
import { projects } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';
import { RENDER_QUEUE, REDIS_PUBLISHER } from '../queue/queue.module.js';

const DOWNLOAD_TTL_SEC = 3600;

@Injectable()
export class RendersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(RENDER_QUEUE) private readonly queue: Queue,
    @Inject(REDIS_PUBLISHER) private readonly publisher: RenderEventPublisher,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ModerationService) private readonly moderation: ModerationService,
  ) {}

  /** Постановка рендера: оценка стоимости → резервирование кредитов → очередь. */
  async create(
    workspaceId: string,
    projectId: string,
    dto: CreateRenderJobDto,
    actor: AuthenticatedUser,
  ) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
    });
    if (!project) {
      throw new NotFoundException({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Проект не найден или удалён.' },
      });
    }

    const sceneRows = await this.db
      .select({ id: scenes.id, script: scenes.script })
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.orderIndex));
    if (!sceneRows.length) {
      throw new BadRequestException({
        error: {
          code: 'EMPTY_PROJECT',
          message: 'В проекте нет сцен — добавьте хотя бы одну и запустите рендер снова.',
        },
      });
    }

    // Валидация разметки до списания кредитов
    let estimatedMs = 0;
    const plainTexts: string[] = [];
    for (const [i, scene] of sceneRows.entries()) {
      const parsed = safeParse(scene.script);
      if (!parsed.success) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_SCRIPT',
            message: `Сцена ${i + 1}: ${parsed.error.message}`,
          },
        });
      }
      const plain = compileToPlainText(parsed.document);
      plainTexts.push(plain);
      estimatedMs += estimateSpeechDurationMs(plain);
    }
    const estimatedCost = creditCost(estimatedMs, dto.quality);

    // Модерация скрипта — до очереди и до резервирования кредитов (правило 1)
    await this.moderation.assertScriptAllowed({
      workspaceId,
      projectId,
      scriptHash: scriptHash(plainTexts),
      plainText: plainTexts.join('\n'),
      actor,
    });

    const [job] = await this.db
      .insert(renderJobs)
      .values({
        projectId,
        workspaceId,
        requestedBy: actor.id,
        quality: dto.quality,
        aspectRatio: project.aspectRatio,
        creditsReserved: estimatedCost.toFixed(2),
      })
      .returning();
    if (!job) throw new Error('insert render_jobs: пустой результат');

    try {
      await reserveCredits(this.db, {
        workspaceId,
        userId: actor.id,
        jobId: job.id,
        amount: estimatedCost,
      });
    } catch (err) {
      await this.db.delete(renderJobs).where(eq(renderJobs.id, job.id));
      if (err instanceof InsufficientCreditsError) {
        throw new HttpException(
          { error: { code: 'INSUFFICIENT_CREDITS', message: err.message } },
          402,
        );
      }
      throw err;
    }

    await recordRenderEvent(this.db, this.publisher, {
      jobId: job.id,
      workspaceId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: `оценка: ${(estimatedMs / 1000).toFixed(1)}с, ${estimatedCost.toFixed(2)} кр.`,
    });
    await this.queue.add(
      'render',
      { jobId: job.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 500 } },
    );
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'render.started',
      target: job.id,
      meta: { projectId, quality: dto.quality, creditsReserved: estimatedCost },
    });

    return {
      jobId: job.id,
      status: job.status,
      creditsReserved: estimatedCost,
      estimatedDurationMs: estimatedMs,
    };
  }

  /** Бесплатный превью-рендер одной сцены (FR-5.4): кредиты не резервируются. */
  async createScenePreview(
    workspaceId: string,
    projectId: string,
    sceneId: string,
    actor: AuthenticatedUser,
  ) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
    });
    if (!project) {
      throw new NotFoundException({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Проект не найден или удалён.' },
      });
    }
    const scene = await this.db.query.scenes.findFirst({
      where: and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)),
    });
    if (!scene) {
      throw new NotFoundException({
        error: { code: 'SCENE_NOT_FOUND', message: 'Сцена не найдена — обновите проект.' },
      });
    }
    const parsed = safeParse(scene.script);
    if (!parsed.success) {
      throw new BadRequestException({
        error: { code: 'INVALID_SCRIPT', message: parsed.error.message },
      });
    }
    const plain = compileToPlainText(parsed.document);
    await this.moderation.assertScriptAllowed({
      workspaceId,
      projectId,
      scriptHash: scriptHash([plain]),
      plainText: plain,
      actor,
    });

    const [job] = await this.db
      .insert(renderJobs)
      .values({
        projectId,
        workspaceId,
        requestedBy: actor.id,
        quality: '720p',
        aspectRatio: project.aspectRatio,
        previewSceneId: sceneId,
        creditsReserved: '0',
      })
      .returning();
    await recordRenderEvent(this.db, this.publisher, {
      jobId: job!.id,
      workspaceId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: 'превью сцены (бесплатно)',
    });
    await this.queue.add(
      'render',
      { jobId: job!.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 500 } },
    );
    return { jobId: job!.id, status: job!.status, creditsReserved: 0 };
  }

  async get(workspaceId: string, jobId: string) {
    const job = await this.db.query.renderJobs.findFirst({
      where: and(eq(renderJobs.id, jobId), eq(renderJobs.workspaceId, workspaceId)),
    });
    if (!job) {
      throw new NotFoundException({
        error: { code: 'RENDER_NOT_FOUND', message: 'Рендер-джоб не найден.' },
      });
    }
    const outputUrl =
      job.status === 'done' && job.outputKey
        ? await this.storage.presignGet(job.outputKey, DOWNLOAD_TTL_SEC)
        : null;
    return { ...job, outputUrl };
  }

  async listForProject(workspaceId: string, projectId: string) {
    return this.db
      .select()
      .from(renderJobs)
      .where(and(eq(renderJobs.projectId, projectId), eq(renderJobs.workspaceId, workspaceId)))
      .orderBy(desc(renderJobs.createdAt));
  }

  async listEvents(workspaceId: string, jobId: string) {
    await this.get(workspaceId, jobId);
    return this.db
      .select()
      .from(renderJobEvents)
      .where(eq(renderJobEvents.jobId, jobId))
      .orderBy(asc(renderJobEvents.id));
  }

  /** Отмена с автовозвратом зарезервированных кредитов (FR-5.2). */
  async cancel(workspaceId: string, jobId: string, actor: AuthenticatedUser) {
    const job = await this.db.query.renderJobs.findFirst({
      where: and(eq(renderJobs.id, jobId), eq(renderJobs.workspaceId, workspaceId)),
    });
    if (!job) {
      throw new NotFoundException({
        error: { code: 'RENDER_NOT_FOUND', message: 'Рендер-джоб не найден.' },
      });
    }
    const finalized = await finalizeRenderJob(this.db, jobId, 'cancelled');
    if (!finalized) {
      throw new ConflictException({
        error: {
          code: 'ALREADY_FINISHED',
          message: 'Рендер уже завершён — отменять нечего.',
        },
      });
    }
    await recordRenderEvent(this.db, this.publisher, {
      jobId,
      workspaceId,
      status: 'cancelled',
      stage: finalized.stage,
      progress: finalized.progress,
      message: 'отменено пользователем, кредиты возвращены',
    });
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'render.cancelled',
      target: jobId,
    });
    return { cancelled: true, creditsRefunded: Number(job.creditsReserved) };
  }
}
