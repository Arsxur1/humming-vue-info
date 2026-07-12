import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type {
  CreateProjectDto,
  CreateSceneDto,
  LayerDto,
  ReorderScenesDto,
  UpdateProjectDto,
  UpdateSceneDto,
} from '@avatarstudio/shared';
import { sceneContentHash } from '@avatarstudio/shared/scene-hash';
import { DB, type Db } from '../db/client.js';
import { layers, projects, projectVersions, scenes } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';

export const MAX_VERSIONS = 30;
const MAX_SCENES = 100;

type SceneRow = typeof scenes.$inferSelect;
type LayerRow = typeof layers.$inferSelect;

interface SceneSnapshot {
  id: string;
  orderIndex: number;
  script: string;
  language: string | null;
  voiceId: string | null;
  avatarId: string | null;
  background: unknown;
  durationMs: number | null;
  transition: SceneRow['transition'];
  contentHash: string;
  layers: Array<Omit<LayerRow, 'id' | 'sceneId'>>;
}

interface ProjectSnapshot {
  title: string;
  aspectRatio: string;
  defaultLanguage: string;
  scenes: SceneSnapshot[];
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------- Проекты ----------

  async create(workspaceId: string, dto: CreateProjectDto, actor: AuthenticatedUser) {
    const [project] = await this.db
      .insert(projects)
      .values({ workspaceId, ...dto, createdBy: actor.id })
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'project.created',
      target: project!.id,
      meta: { title: dto.title },
    });
    return project;
  }

  async list(workspaceId: string) {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.updatedAt));
  }

  async get(workspaceId: string, projectId: string) {
    const project = await this.requireProject(workspaceId, projectId);
    const sceneRows = await this.db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.orderIndex));
    const layerRows = sceneRows.length
      ? await this.db
          .select()
          .from(layers)
          .where(inArray(layers.sceneId, sceneRows.map((s) => s.id)))
          .orderBy(asc(layers.zIndex))
      : [];
    return {
      ...project,
      scenes: sceneRows.map((s) => ({
        ...s,
        layers: layerRows.filter((l) => l.sceneId === s.id),
      })),
    };
  }

  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
    actor: AuthenticatedUser,
  ) {
    await this.requireProject(workspaceId, projectId);
    const [updated] = await this.db
      .update(projects)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'project.updated',
      target: projectId,
      meta: dto,
    });
    return updated;
  }

  async remove(workspaceId: string, projectId: string, actor: AuthenticatedUser) {
    await this.requireProject(workspaceId, projectId);
    await this.db.delete(projects).where(eq(projects.id, projectId));
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'project.deleted',
      target: projectId,
    });
    return { deleted: true };
  }

  // ---------- Сцены ----------

  async createScene(
    workspaceId: string,
    projectId: string,
    dto: CreateSceneDto,
    actor: AuthenticatedUser,
  ) {
    await this.requireProject(workspaceId, projectId);
    return this.db.transaction(async (tx) => {
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(scenes)
        .where(eq(scenes.projectId, projectId));
      const count = countRow?.count ?? 0;
      if (count >= MAX_SCENES) {
        throw new BadRequestException({
          error: {
            code: 'TOO_MANY_SCENES',
            message: `В проекте не может быть больше ${MAX_SCENES} сцен. Разбейте материал на несколько проектов.`,
          },
        });
      }
      const contentHash = sceneContentHash({
        script: dto.script,
        voiceId: dto.voiceId,
        avatarId: dto.avatarId,
        layers: normalizeLayers(dto.layers),
        renderParams: {},
      });
      const [scene] = await tx
        .insert(scenes)
        .values({
          projectId,
          orderIndex: count,
          script: dto.script,
          language: dto.language,
          voiceId: dto.voiceId,
          avatarId: dto.avatarId,
          background: dto.background,
          transition: dto.transition,
          contentHash,
        })
        .returning();
      if (dto.layers.length) {
        await tx
          .insert(layers)
          .values(dto.layers.map((l) => ({ ...l, sceneId: scene!.id })));
      }
      await this.touchProject(tx, projectId);
      await this.audit.record({
        workspaceId,
        actorId: actor.id,
        action: 'scene.created',
        target: scene!.id,
      });
      return scene;
    });
  }

  /** Автосохранение: оптимистическая блокировка по version counter. */
  async updateScene(
    workspaceId: string,
    projectId: string,
    sceneId: string,
    dto: UpdateSceneDto,
    _actor: AuthenticatedUser,
  ) {
    await this.requireProject(workspaceId, projectId);
    return this.db.transaction(async (tx) => {
      const scene = await tx.query.scenes.findFirst({
        where: and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)),
      });
      if (!scene) {
        throw new NotFoundException({
          error: { code: 'SCENE_NOT_FOUND', message: 'Сцена не найдена — обновите проект.' },
        });
      }

      const { expectedVersion, layers: newLayers, ...fields } = dto;

      const effectiveLayers =
        newLayers !== undefined
          ? normalizeLayers(newLayers)
          : normalizeLayers(
              (await tx
                .select()
                .from(layers)
                .where(eq(layers.sceneId, sceneId))
                .orderBy(asc(layers.zIndex))) as unknown as LayerDto[],
            );
      const contentHash = sceneContentHash({
        script: fields.script ?? scene.script,
        voiceId: fields.voiceId !== undefined ? fields.voiceId : scene.voiceId,
        avatarId: fields.avatarId !== undefined ? fields.avatarId : scene.avatarId,
        layers: effectiveLayers,
        renderParams: {},
      });

      const [updated] = await tx
        .update(scenes)
        .set({ ...fields, contentHash, version: scene.version + 1, updatedAt: new Date() })
        .where(and(eq(scenes.id, sceneId), eq(scenes.version, expectedVersion)))
        .returning();
      if (!updated) {
        throw new ConflictException({
          error: {
            code: 'VERSION_CONFLICT',
            message:
              'Сцена изменена в другой вкладке или сессии. Обновите проект и повторите правку.',
            details: { currentVersion: scene.version, expectedVersion },
          },
        });
      }

      if (newLayers !== undefined) {
        await tx.delete(layers).where(eq(layers.sceneId, sceneId));
        if (newLayers.length) {
          await tx.insert(layers).values(newLayers.map((l) => ({ ...l, sceneId })));
        }
      }
      await this.touchProject(tx, projectId);
      return updated;
    });
  }

  async removeScene(
    workspaceId: string,
    projectId: string,
    sceneId: string,
    actor: AuthenticatedUser,
  ) {
    await this.requireProject(workspaceId, projectId);
    const deleted = await this.db
      .delete(scenes)
      .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)))
      .returning({ id: scenes.id });
    if (!deleted.length) {
      throw new NotFoundException({
        error: { code: 'SCENE_NOT_FOUND', message: 'Сцена не найдена — обновите проект.' },
      });
    }
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'scene.deleted',
      target: sceneId,
    });
    return { deleted: true };
  }

  async reorderScenes(workspaceId: string, projectId: string, dto: ReorderScenesDto) {
    await this.requireProject(workspaceId, projectId);
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: scenes.id })
        .from(scenes)
        .where(eq(scenes.projectId, projectId));
      const existingIds = new Set(existing.map((s) => s.id));
      if (
        dto.sceneIds.length !== existingIds.size ||
        dto.sceneIds.some((id) => !existingIds.has(id))
      ) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_SCENE_ORDER',
            message: 'Список сцен не совпадает с проектом. Обновите проект и повторите.',
          },
        });
      }
      for (const [index, id] of dto.sceneIds.entries()) {
        await tx.update(scenes).set({ orderIndex: index }).where(eq(scenes.id, id));
      }
      await this.touchProject(tx, projectId);
      return { reordered: true };
    });
  }

  // ---------- Версии (снимки ≥ 30, откат, diff) ----------

  async createSnapshot(
    workspaceId: string,
    projectId: string,
    actor: AuthenticatedUser | null,
    label?: string,
  ) {
    const snapshot = await this.buildSnapshot(workspaceId, projectId);
    const [version] = await this.db
      .insert(projectVersions)
      .values({ projectId, snapshot, label: label ?? null, createdBy: actor?.id ?? null })
      .returning({ id: projectVersions.id, createdAt: projectVersions.createdAt });

    // Храним не менее MAX_VERSIONS последних снимков — старые за пределами лимита удаляем
    const cutoff = await this.db
      .select({ id: projectVersions.id, createdAt: projectVersions.createdAt })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, projectId))
      .orderBy(desc(projectVersions.createdAt), desc(projectVersions.id))
      .offset(MAX_VERSIONS)
      .limit(1);
    if (cutoff.length) {
      await this.db
        .delete(projectVersions)
        .where(
          and(
            eq(projectVersions.projectId, projectId),
            lt(projectVersions.createdAt, cutoff[0]!.createdAt),
          ),
        );
    }
    return version;
  }

  async listVersions(workspaceId: string, projectId: string) {
    await this.requireProject(workspaceId, projectId);
    return this.db
      .select({
        id: projectVersions.id,
        label: projectVersions.label,
        createdBy: projectVersions.createdBy,
        createdAt: projectVersions.createdAt,
      })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, projectId))
      .orderBy(desc(projectVersions.createdAt), desc(projectVersions.id));
  }

  /** Откат: перед восстановлением автоматически снимается снимок текущего состояния. */
  async restoreVersion(
    workspaceId: string,
    projectId: string,
    versionId: string,
    actor: AuthenticatedUser,
  ) {
    await this.requireProject(workspaceId, projectId);
    const version = await this.db.query.projectVersions.findFirst({
      where: and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId)),
    });
    if (!version) {
      throw new NotFoundException({
        error: { code: 'VERSION_NOT_FOUND', message: 'Версия не найдена в истории проекта.' },
      });
    }
    await this.createSnapshot(workspaceId, projectId, actor, 'auto: перед откатом');

    const snap = version.snapshot as ProjectSnapshot;
    await this.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          title: snap.title,
          aspectRatio: snap.aspectRatio as never,
          defaultLanguage: snap.defaultLanguage,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
      await tx.delete(scenes).where(eq(scenes.projectId, projectId));
      for (const s of snap.scenes) {
        const [scene] = await tx
          .insert(scenes)
          .values({
            id: s.id,
            projectId,
            orderIndex: s.orderIndex,
            script: s.script,
            language: s.language,
            voiceId: s.voiceId,
            avatarId: s.avatarId,
            background: s.background ?? {},
            durationMs: s.durationMs,
            transition: s.transition,
            contentHash: s.contentHash,
          })
          .returning({ id: scenes.id });
        if (s.layers.length) {
          await tx.insert(layers).values(s.layers.map((l) => ({ ...l, sceneId: scene!.id })));
        }
      }
    });
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'project.version_restored',
      target: projectId,
      meta: { versionId },
    });
    return { restored: true, versionId };
  }

  /** Diff версии против текущего состояния (по content_hash сцен). */
  async diffVersion(workspaceId: string, projectId: string, versionId: string) {
    const version = await this.db.query.projectVersions.findFirst({
      where: and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId)),
    });
    if (!version) {
      throw new NotFoundException({
        error: { code: 'VERSION_NOT_FOUND', message: 'Версия не найдена в истории проекта.' },
      });
    }
    const old = version.snapshot as ProjectSnapshot;
    const current = await this.buildSnapshot(workspaceId, projectId);

    const oldById = new Map(old.scenes.map((s) => [s.id, s]));
    const curById = new Map(current.scenes.map((s) => [s.id, s]));
    return {
      titleChanged: old.title !== current.title ? { from: old.title, to: current.title } : null,
      addedScenes: current.scenes.filter((s) => !oldById.has(s.id)).map((s) => s.id),
      removedScenes: old.scenes.filter((s) => !curById.has(s.id)).map((s) => s.id),
      changedScenes: current.scenes
        .filter((s) => {
          const prev = oldById.get(s.id);
          return prev !== undefined && prev.contentHash !== s.contentHash;
        })
        .map((s) => s.id),
    };
  }

  // ---------- Внутреннее ----------

  private async buildSnapshot(workspaceId: string, projectId: string): Promise<ProjectSnapshot> {
    const project = await this.requireProject(workspaceId, projectId);
    const sceneRows = await this.db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.orderIndex));
    const layerRows = sceneRows.length
      ? await this.db
          .select()
          .from(layers)
          .where(inArray(layers.sceneId, sceneRows.map((s) => s.id)))
          .orderBy(asc(layers.zIndex))
      : [];
    return {
      title: project.title,
      aspectRatio: project.aspectRatio,
      defaultLanguage: project.defaultLanguage,
      scenes: sceneRows.map((s) => ({
        id: s.id,
        orderIndex: s.orderIndex,
        script: s.script,
        language: s.language,
        voiceId: s.voiceId,
        avatarId: s.avatarId,
        background: s.background,
        durationMs: s.durationMs,
        transition: s.transition,
        contentHash: s.contentHash,
        layers: layerRows
          .filter((l) => l.sceneId === s.id)
          .map(({ id: _id, sceneId: _sceneId, ...rest }) => rest),
      })),
    };
  }

  private async requireProject(workspaceId: string, projectId: string) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
    });
    if (!project) {
      throw new NotFoundException({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Проект не найден или удалён.' },
      });
    }
    return project;
  }

  private async touchProject(tx: Db | Parameters<Parameters<Db['transaction']>[0]>[0], projectId: string) {
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  }
}

/** Каноничная форма слоёв для hash — без id/sceneId, только контент. */
function normalizeLayers(list: readonly LayerDto[]): unknown[] {
  return list.map((l) => ({
    type: l.type,
    zIndex: l.zIndex,
    props: l.props ?? {},
    startMs: l.startMs ?? null,
    endMs: l.endMs ?? null,
    keyframes: l.keyframes ?? null,
  }));
}
