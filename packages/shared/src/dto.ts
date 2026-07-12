import { z } from 'zod';
import { ROLES } from './rbac.js';

/** DTO-схемы API (Этап 1). Используются и сервером (валидация), и клиентом (типы). */

export const registerSchema = z.object({
  email: z.string().email('Укажите корректный e-mail'),
  password: z.string().min(8, 'Пароль — минимум 8 символов'),
  name: z.string().trim().min(1, 'Укажите имя').max(200),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Укажите корректный e-mail'),
  password: z.string().min(1, 'Укажите пароль'),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Отсутствует refresh-токен'),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Отсутствует токен подтверждения'),
});
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название workspace').max(120),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название workspace').max(120),
});
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;

const invitableRoles = ROLES.filter((r) => r !== 'owner') as [
  (typeof ROLES)[number],
  ...(typeof ROLES)[number][],
];

export const inviteMemberSchema = z.object({
  email: z.string().email('Укажите корректный e-mail приглашаемого'),
  role: z.enum(invitableRoles, {
    errorMap: () => ({ message: 'Роль owner назначить нельзя; выберите admin/editor/reviewer/viewer' }),
  }),
});
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Отсутствует токен приглашения'),
});
export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;

// ---------- Этап 3: проекты, сцены, слои, ассеты ----------

export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '4:3'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const LAYER_TYPES = [
  'text',
  'image',
  'video',
  'shape',
  'subtitle',
  'screen_recording',
] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export const SCENE_TRANSITIONS = ['cut', 'fade', 'dissolve', 'slide', 'wipe'] as const;
export type SceneTransition = (typeof SCENE_TRANSITIONS)[number];

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название проекта').max(200),
  aspectRatio: z.enum(ASPECT_RATIOS).default('16:9'),
  defaultLanguage: z.string().min(2).max(20).default('ru'),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    aspectRatio: z.enum(ASPECT_RATIOS),
    defaultLanguage: z.string().min(2).max(20),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Нет полей для обновления' });
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export const layerSchema = z.object({
  type: z.enum(LAYER_TYPES),
  zIndex: z.number().int().min(0).max(1000),
  props: z.record(z.unknown()).default({}),
  startMs: z.number().int().min(0).nullable().default(null),
  endMs: z.number().int().min(0).nullable().default(null),
  keyframes: z.array(z.record(z.unknown())).nullable().default(null),
});
export type LayerDto = z.infer<typeof layerSchema>;

export const createSceneSchema = z.object({
  script: z.string().max(5000, 'Скрипт сцены — не более 5000 символов').default(''),
  language: z.string().min(2).max(20).nullable().default(null),
  voiceId: z.string().max(100).nullable().default(null),
  avatarId: z.string().max(100).nullable().default(null),
  background: z.record(z.unknown()).default({}),
  transition: z.enum(SCENE_TRANSITIONS).default('cut'),
  layers: z.array(layerSchema).max(50).default([]),
});
export type CreateSceneDto = z.infer<typeof createSceneSchema>;

export const updateSceneSchema = z.object({
  /** Оптимистическая блокировка: версия, которую видел клиент. */
  expectedVersion: z.number().int().min(1, 'expectedVersion обязателен для автосохранения'),
  script: z.string().max(5000).optional(),
  language: z.string().min(2).max(20).nullable().optional(),
  voiceId: z.string().max(100).nullable().optional(),
  avatarId: z.string().max(100).nullable().optional(),
  background: z.record(z.unknown()).optional(),
  durationMs: z.number().int().min(0).nullable().optional(),
  transition: z.enum(SCENE_TRANSITIONS).optional(),
  layers: z.array(layerSchema).max(50).optional(),
});
export type UpdateSceneDto = z.infer<typeof updateSceneSchema>;

export const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string().uuid()).min(1, 'Передайте порядок сцен'),
});
export type ReorderScenesDto = z.infer<typeof reorderScenesSchema>;

export const restoreVersionSchema = z.object({});

// ---------- Этап 5: модерация и шаринг ----------

export const resolveModerationCaseSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
});
export type ResolveModerationCaseDto = z.infer<typeof resolveModerationCaseSchema>;

export const SHARE_VISIBILITIES = ['public', 'password', 'members'] as const;
export type ShareVisibility = (typeof SHARE_VISIBILITIES)[number];

export const createShareSchema = z
  .object({
    visibility: z.enum(SHARE_VISIBILITIES),
    password: z.string().min(4, 'Пароль ссылки — минимум 4 символа').optional(),
    ttlHours: z.number().int().min(1).max(24 * 365).optional(),
  })
  .refine((v) => v.visibility !== 'password' || !!v.password, {
    message: 'Для ссылки с паролем укажите пароль',
  });
export type CreateShareDto = z.infer<typeof createShareSchema>;

export const accessShareSchema = z.object({
  password: z.string().optional(),
});
export type AccessShareDto = z.infer<typeof accessShareSchema>;

export const requestUploadSchema = z.object({
  fileName: z.string().trim().min(1, 'Укажите имя файла').max(300),
  mime: z.string().min(3).max(150),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(500 * 1024 * 1024, 'Файл больше 500 МБ — загрузите файл меньшего размера'),
});
export type RequestUploadDto = z.infer<typeof requestUploadSchema>;
