import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { RequestUploadDto } from '@avatarstudio/shared';
import { DB, type Db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';
import { PreviewService } from './preview.service.js';
import { VIRUS_SCANNER, type VirusScanner } from './virus-scanner.js';

const UPLOAD_TTL_SEC = 15 * 60;

@Injectable()
export class AssetsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(PreviewService) private readonly preview: PreviewService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Шаг 1: регистрируем ассет и выдаём presigned URL — файл идёт мимо API (S3) или на /api/uploads (fs). */
  async requestUpload(workspaceId: string, dto: RequestUploadDto, actor: AuthenticatedUser) {
    const ext = dto.fileName.includes('.') ? dto.fileName.split('.').pop() : 'bin';
    const storageKey = `workspaces/${workspaceId}/assets/${randomUUID()}.${ext}`;
    const [asset] = await this.db
      .insert(assets)
      .values({
        workspaceId,
        storageKey,
        originalName: dto.fileName,
        mime: dto.mime,
        sizeBytes: dto.sizeBytes,
        createdBy: actor.id,
      })
      .returning();
    if (!asset) throw new Error('insert assets: пустой результат');

    const upload = await this.storage.presignPut(storageKey, dto.mime, UPLOAD_TTL_SEC);
    return { assetId: asset.id, upload };
  }

  /** Шаг 2: файл загружен → проверяем наличие, антивирус, превью для изображений. */
  async complete(workspaceId: string, assetId: string, actor: AuthenticatedUser) {
    const asset = await this.db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.workspaceId, workspaceId)),
    });
    if (!asset) {
      throw new NotFoundException({
        error: { code: 'ASSET_NOT_FOUND', message: 'Ассет не найден. Начните загрузку заново.' },
      });
    }
    if (asset.status !== 'pending') return this.toPublic(asset);

    if (!(await this.storage.exists(asset.storageKey))) {
      throw new BadRequestException({
        error: {
          code: 'FILE_NOT_UPLOADED',
          message: 'Файл ещё не загружен в хранилище. Завершите PUT по presigned-ссылке и повторите.',
        },
      });
    }

    const sample = await this.storage.read(asset.storageKey);
    const scan = await this.scanner.scan(asset.storageKey, sample);
    if (!scan.clean) {
      const [rejected] = await this.db
        .update(assets)
        .set({ status: 'rejected', scannedAt: new Date() })
        .where(eq(assets.id, assetId))
        .returning();
      await this.audit.record({
        workspaceId,
        actorId: actor.id,
        action: 'asset.rejected',
        target: assetId,
      });
      return this.toPublic(rejected!);
    }

    let previewKey: string | null = null;
    if (asset.mime.startsWith('image/')) {
      previewKey = `${asset.storageKey}.preview.jpg`;
      try {
        await this.preview.createImagePreview(asset.storageKey, previewKey);
      } catch (err) {
        // превью — best-effort: его отсутствие не блокирует ассет
        console.warn(`[assets] превью не сгенерировано для ${assetId}:`, err);
        previewKey = null;
      }
    }

    const [updated] = await this.db
      .update(assets)
      .set({ status: 'clean', scannedAt: new Date(), previewKey })
      .where(eq(assets.id, assetId))
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'asset.uploaded',
      target: assetId,
      meta: { name: asset.originalName, sizeBytes: asset.sizeBytes },
    });
    return this.toPublic(updated!);
  }

  async list(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(assets)
      .where(eq(assets.workspaceId, workspaceId))
      .orderBy(desc(assets.createdAt));
    return rows.map((a) => this.toPublic(a));
  }

  private toPublic(asset: typeof assets.$inferSelect) {
    return {
      id: asset.id,
      name: asset.originalName,
      mime: asset.mime,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
      hasPreview: asset.previewKey !== null,
      createdAt: asset.createdAt,
    };
  }
}
