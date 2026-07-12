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
