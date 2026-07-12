import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  real,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ASPECT_RATIOS, LAYER_TYPES, ROLES, SCENE_TRANSITIONS } from '@avatarstudio/shared';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    uiLocale: text('ui_locale').notNull().default('ru'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

export const emailVerifications = pgTable('email_verifications', {
  token: text('token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash)],
);

export const roleEnumValues = ROLES;

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  /** Кредиты (FR-10.1: 1 кредит = 1 мин 1080p). Стартовые 10 — dev-дефолт до Этапа 8. */
  creditsBalance: numeric('credits_balance', { precision: 12, scale: 2 })
    .notNull()
    .default('10'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ROLES }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ROLES }).notNull(),
    token: text('token').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invitations_token_unique').on(t.token),
    index('invitations_workspace_idx').on(t.workspaceId),
  ],
);

// ---------- Этап 3: проекты, сцены, слои, версии, ассеты ----------

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    aspectRatio: text('aspect_ratio', { enum: ASPECT_RATIOS }).notNull().default('16:9'),
    defaultLanguage: text('default_language').notNull().default('ru'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_workspace_idx').on(t.workspaceId)],
);

export const scenes = pgTable(
  'scenes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    /** Скрипт вместе с Director Markup (теги инлайновые). */
    script: text('script').notNull().default(''),
    language: text('language'),
    voiceId: text('voice_id'),
    avatarId: text('avatar_id'),
    audioAssetId: uuid('audio_asset_id'),
    background: jsonb('background').notNull().default(sql`'{}'::jsonb`),
    durationMs: integer('duration_ms'),
    transition: text('transition', { enum: SCENE_TRANSITIONS }).notNull().default('cut'),
    contentHash: text('content_hash').notNull(),
    /** Счётчик оптимистической блокировки автосохранения. */
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scenes_project_idx').on(t.projectId, t.orderIndex)],
);

export const layers = pgTable(
  'layers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sceneId: uuid('scene_id')
      .notNull()
      .references(() => scenes.id, { onDelete: 'cascade' }),
    type: text('type', { enum: LAYER_TYPES }).notNull(),
    zIndex: integer('z_index').notNull().default(0),
    props: jsonb('props').notNull().default(sql`'{}'::jsonb`),
    startMs: integer('start_ms'),
    endMs: integer('end_ms'),
    keyframes: jsonb('keyframes'),
  },
  (t) => [index('layers_scene_idx').on(t.sceneId, t.zIndex)],
);

export const projectVersions = pgTable(
  'project_versions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    snapshot: jsonb('snapshot').notNull(),
    label: text('label'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_versions_project_idx').on(t.projectId, t.createdAt)],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Ключ объекта в хранилище (S3/fs). */
    storageKey: text('storage_key').notNull(),
    previewKey: text('preview_key'),
    originalName: text('original_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: text('status', { enum: ['pending', 'clean', 'rejected'] })
      .notNull()
      .default('pending'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assets_workspace_idx').on(t.workspaceId)],
);

/** Append-only: UPDATE/DELETE запрещены триггером в миграции. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: uuid('workspace_id'),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    target: text('target'),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_workspace_idx').on(t.workspaceId, t.createdAt)],
);

// ---------- Этап 4: рендер-пайплайн ----------

export const RENDER_QUALITIES_DB = ['720p', '1080p'] as const;

export const renderJobs = pgTable(
  'render_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    quality: text('quality', { enum: RENDER_QUALITIES_DB }).notNull(),
    aspectRatio: text('aspect_ratio', { enum: ASPECT_RATIOS }).notNull(),
    status: text('status', { enum: ['queued', 'running', 'done', 'failed', 'cancelled'] })
      .notNull()
      .default('queued'),
    /** Текущая стадия DAG: queued|preprocessing|tts|lipsync|compositing|encoding. */
    stage: text('stage').notNull().default('queued'),
    progress: real('progress').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    creditsReserved: numeric('credits_reserved', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    creditsCharged: numeric('credits_charged', { precision: 12, scale: 2 }),
    outputKey: text('output_key'),
    durationMs: integer('duration_ms'),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('render_jobs_project_idx').on(t.projectId, t.createdAt),
    index('render_jobs_workspace_idx').on(t.workspaceId),
  ],
);

/** Каждый переход статуса/стадии — строка здесь + WebSocket (CLAUDE.md). */
export const renderJobEvents = pgTable(
  'render_job_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => renderJobs.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    stage: text('stage').notNull(),
    progress: real('progress').notNull().default(0),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('render_job_events_job_idx').on(t.jobId, t.id)],
);

/** Scene-cache (D4, FR-5.3): content_hash → готовый сегмент. Попадание = 0 работы. */
export const sceneRenderCache = pgTable('scene_render_cache', {
  contentHash: text('content_hash').primaryKey(),
  segmentKey: text('segment_key').notNull(),
  durationMs: integer('duration_ms').notNull(),
  /** Сколько мс занял рендер сегмента (для юнит-экономики; у моков ~реальное время ffmpeg). */
  renderMs: integer('render_ms').notNull().default(0),
  hits: integer('hits').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    delta: numeric('delta', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason', { enum: ['reserve', 'refund', 'refund_diff'] }).notNull(),
    jobId: uuid('job_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('credit_transactions_workspace_idx').on(t.workspaceId, t.createdAt)],
);
