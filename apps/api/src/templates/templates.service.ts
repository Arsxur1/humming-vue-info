import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  applyVariables,
  extractPlaceholders,
  type CreateTemplateDto,
  type InstantiateTemplateDto,
} from '@avatarstudio/shared';
import { sceneContentHash } from '@avatarstudio/shared/scene-hash';
import {
  layers,
  projects,
  scenes,
  templates,
  type Db,
} from '@avatarstudio/db';
import { DB } from '../db/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';
import { TEMPLATE_SEEDS } from './template-seeds.js';

interface SnapshotLayer {
  type: (typeof layers.$inferInsert)['type'];
  zIndex: number;
  props: Record<string, unknown>;
  startMs: number | null;
  endMs: number | null;
}

interface SnapshotScene {
  script: string;
  language: string | null;
  voiceId: string | null;
  avatarId: string | null;
  background: Record<string, unknown>;
  transition: (typeof scenes.$inferInsert)['transition'];
  layers: SnapshotLayer[];
}

export interface TemplateSnapshot {
  title: string;
  aspectRatio: (typeof projects.$inferInsert)['aspectRatio'];
  defaultLanguage: string;
  scenes: SnapshotScene[];
}

@Injectable()
export class TemplatesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Глобальные (стоковые) + шаблоны workspace, с извлечёнными плейсхолдерами. */
  async list(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(templates)
      .where(or(isNull(templates.workspaceId), eq(templates.workspaceId, workspaceId)))
      .orderBy(asc(templates.category), desc(templates.createdAt));
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      isStock: t.workspaceId === null,
      placeholders: this.placeholdersOf(t.snapshot as TemplateSnapshot),
      scenes: (t.snapshot as TemplateSnapshot).scenes.length,
    }));
  }

  /** Сохранение проекта как шаблона workspace (FR-6.3). */
  async createFromProject(workspaceId: string, dto: CreateTemplateDto, actor: AuthenticatedUser) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, dto.projectId), eq(projects.workspaceId, workspaceId)),
    });
    if (!project) {
      throw new NotFoundException({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Проект не найден или удалён.' },
      });
    }
    const sceneRows = await this.db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, project.id))
      .orderBy(asc(scenes.orderIndex));
    if (!sceneRows.length) {
      throw new BadRequestException({
        error: {
          code: 'EMPTY_PROJECT',
          message: 'В проекте нет сцен — шаблон было бы не из чего создавать.',
        },
      });
    }
    const layerRows = await this.db
      .select()
      .from(layers)
      .where(inArray(layers.sceneId, sceneRows.map((s) => s.id)))
      .orderBy(asc(layers.zIndex));

    const snapshot: TemplateSnapshot = {
      title: project.title,
      aspectRatio: project.aspectRatio,
      defaultLanguage: project.defaultLanguage,
      scenes: sceneRows.map((s) => ({
        script: s.script,
        language: s.language,
        voiceId: s.voiceId,
        avatarId: s.avatarId,
        background: s.background as Record<string, unknown>,
        transition: s.transition,
        layers: layerRows
          .filter((l) => l.sceneId === s.id)
          .map((l) => ({
            type: l.type,
            zIndex: l.zIndex,
            props: l.props as Record<string, unknown>,
            startMs: l.startMs,
            endMs: l.endMs,
          })),
      })),
    };

    const [created] = await this.db
      .insert(templates)
      .values({
        workspaceId,
        name: dto.name,
        category: dto.category,
        description: dto.description ?? null,
        snapshot,
        createdBy: actor.id,
      })
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'template.created',
      target: created!.id,
      meta: { name: dto.name, projectId: dto.projectId },
    });
    return {
      id: created!.id,
      name: created!.name,
      category: created!.category,
      placeholders: this.placeholdersOf(snapshot),
    };
  }

  /** Проект из шаблона с подстановкой переменных (FR-6.2). */
  async instantiate(
    workspaceId: string,
    templateId: string,
    dto: InstantiateTemplateDto,
    actor: AuthenticatedUser,
  ) {
    const template = await this.db.query.templates.findFirst({
      where: and(
        eq(templates.id, templateId),
        or(isNull(templates.workspaceId), eq(templates.workspaceId, workspaceId)),
      ),
    });
    if (!template) {
      throw new NotFoundException({
        error: { code: 'TEMPLATE_NOT_FOUND', message: 'Шаблон не найден.' },
      });
    }
    const snapshot = template.snapshot as TemplateSnapshot;

    const required = this.placeholdersOf(snapshot);
    const missing = required.filter((p) => !(p in dto.variables));
    if (missing.length) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_VARIABLES',
          message: `Заполните переменные шаблона: ${missing.map((m) => `{{${m}}}`).join(', ')}.`,
          details: { missing },
        },
      });
    }

    const fill = (text: string) => applyVariables(text, dto.variables);
    const project = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          workspaceId,
          title: dto.title ?? fill(snapshot.title),
          aspectRatio: snapshot.aspectRatio,
          defaultLanguage: snapshot.defaultLanguage,
          createdBy: actor.id,
        })
        .returning();
      for (const [index, scene] of snapshot.scenes.entries()) {
        const script = fill(scene.script);
        const sceneLayers = scene.layers.map((l) => ({
          ...l,
          props:
            typeof l.props.text === 'string'
              ? { ...l.props, text: fill(l.props.text) }
              : l.props,
        }));
        const [insertedScene] = await tx
          .insert(scenes)
          .values({
            projectId: created!.id,
            orderIndex: index,
            script,
            language: scene.language,
            voiceId: scene.voiceId,
            avatarId: scene.avatarId,
            background: scene.background,
            transition: scene.transition,
            contentHash: sceneContentHash({
              script,
              voiceId: scene.voiceId,
              avatarId: scene.avatarId,
              layers: sceneLayers,
              renderParams: {},
            }),
          })
          .returning({ id: scenes.id });
        if (sceneLayers.length) {
          await tx
            .insert(layers)
            .values(sceneLayers.map((l) => ({ ...l, sceneId: insertedScene!.id })));
        }
      }
      return created!;
    });

    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'project.created_from_template',
      target: project.id,
      meta: { templateId, name: template.name },
    });
    return { projectId: project.id, title: project.title };
  }

  async remove(workspaceId: string, templateId: string, actor: AuthenticatedUser) {
    const deleted = await this.db
      .delete(templates)
      .where(and(eq(templates.id, templateId), eq(templates.workspaceId, workspaceId)))
      .returning({ id: templates.id });
    if (!deleted.length) {
      throw new NotFoundException({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Шаблон не найден (стоковые шаблоны удалить нельзя).',
        },
      });
    }
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'template.deleted',
      target: templateId,
    });
    return { deleted: true };
  }

  private placeholdersOf(snapshot: TemplateSnapshot): string[] {
    const all = new Set<string>();
    for (const p of extractPlaceholders(snapshot.title)) all.add(p);
    for (const scene of snapshot.scenes) {
      for (const p of extractPlaceholders(scene.script)) all.add(p);
      for (const layer of scene.layers) {
        if (typeof layer.props.text === 'string') {
          for (const p of extractPlaceholders(layer.props.text)) all.add(p);
        }
      }
    }
    return [...all];
  }
}

/** Идемпотентные сиды стоковых шаблонов — вызывается при старте api. */
export async function seedGlobalTemplates(db: Db): Promise<number> {
  const existing = await db
    .select({ name: templates.name })
    .from(templates)
    .where(isNull(templates.workspaceId));
  const have = new Set(existing.map((t) => t.name));
  let inserted = 0;
  for (const seed of TEMPLATE_SEEDS) {
    if (have.has(seed.name)) continue;
    const snapshot: TemplateSnapshot = {
      title: seed.name,
      aspectRatio: seed.aspectRatio,
      defaultLanguage: 'ru',
      scenes: seed.scenes.map((s) => ({
        script: s.script,
        language: null,
        voiceId: null,
        avatarId: null,
        background: s.background,
        transition: 'fade',
        layers: s.title
          ? [
              {
                type: 'text' as const,
                zIndex: 1,
                props: {
                  text: s.title,
                  placements: { '16:9': { x: 0.06, y: 0.08, scale: 1, rotation: 0 } },
                },
                startMs: null,
                endMs: null,
              },
            ]
          : [],
      })),
    };
    await db.insert(templates).values({
      workspaceId: null,
      name: seed.name,
      category: seed.category,
      description: seed.description,
      snapshot,
    });
    inserted += 1;
  }
  return inserted;
}
