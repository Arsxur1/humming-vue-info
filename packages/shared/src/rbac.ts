/**
 * RBAC (FR-1.3): роли Owner/Admin/Editor/Reviewer/Viewer.
 * Матрица прав — данные, не if-ы (docs/PLAN.md, Этап 1).
 * Правка прав = правка этой таблицы + unit-тестов, не кода guard'ов.
 */

export const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Workspace
  'workspace.view',
  'workspace.update',
  'workspace.delete',
  // Участники
  'members.view',
  'members.invite',
  'members.remove',
  'members.role.update',
  // Проекты (появятся на Этапе 3; права фиксируем уже сейчас)
  'project.view',
  'project.create',
  'project.update',
  'project.delete',
  // Ассеты (Этап 3)
  'asset.upload',
  // Рендер (Этап 4)
  'render.start',
  'render.cancel',
  // Ревью
  'comment.create',
  'review.approve',
  // Шаринг (Этап 5)
  'share.create',
  // Модерация (Этап 5)
  'moderation.review',
  // Аудит
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: readonly Permission[] = ['workspace.view', 'members.view', 'project.view'];

const REVIEWER: readonly Permission[] = [...VIEWER, 'comment.create', 'review.approve'];

const EDITOR: readonly Permission[] = [
  ...VIEWER,
  'comment.create',
  'project.create',
  'project.update',
  'asset.upload',
  'render.start',
  'render.cancel',
  'share.create',
];

const ADMIN: readonly Permission[] = [
  ...new Set([
    ...EDITOR,
    ...REVIEWER,
    'workspace.update',
    'members.invite',
    'members.remove',
    'members.role.update',
    'project.delete',
    'audit.view',
    'moderation.review',
  ] as Permission[]),
];

const OWNER: readonly Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: OWNER,
  admin: ADMIN,
  editor: EDITOR,
  reviewer: REVIEWER,
  viewer: VIEWER,
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Роли, которые участник с данной ролью может назначать другим (никто не назначает owner). */
export const ASSIGNABLE_ROLES: Record<Role, readonly Role[]> = {
  owner: ['admin', 'editor', 'reviewer', 'viewer'],
  admin: ['editor', 'reviewer', 'viewer'],
  editor: [],
  reviewer: [],
  viewer: [],
};
