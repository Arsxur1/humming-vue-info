import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  roleHasPermission,
} from '../src/rbac.js';

describe('RBAC-матрица (FR-1.3)', () => {
  it('owner имеет все права', () => {
    for (const p of PERMISSIONS) {
      expect(roleHasPermission('owner', p), `owner должен иметь ${p}`).toBe(true);
    }
  });

  it('viewer — только просмотр', () => {
    expect(roleHasPermission('viewer', 'workspace.view')).toBe(true);
    expect(roleHasPermission('viewer', 'project.view')).toBe(true);
    expect(roleHasPermission('viewer', 'members.invite')).toBe(false);
    expect(roleHasPermission('viewer', 'workspace.update')).toBe(false);
    expect(roleHasPermission('viewer', 'project.create')).toBe(false);
    expect(roleHasPermission('viewer', 'render.start')).toBe(false);
    expect(roleHasPermission('viewer', 'audit.view')).toBe(false);
  });

  it('reviewer может комментировать и утверждать, но не редактировать', () => {
    expect(roleHasPermission('reviewer', 'comment.create')).toBe(true);
    expect(roleHasPermission('reviewer', 'review.approve')).toBe(true);
    expect(roleHasPermission('reviewer', 'project.update')).toBe(false);
    expect(roleHasPermission('reviewer', 'render.start')).toBe(false);
  });

  it('editor работает с проектами и рендером, но не управляет участниками', () => {
    expect(roleHasPermission('editor', 'project.create')).toBe(true);
    expect(roleHasPermission('editor', 'render.start')).toBe(true);
    expect(roleHasPermission('editor', 'members.invite')).toBe(false);
    expect(roleHasPermission('editor', 'workspace.update')).toBe(false);
  });

  it('admin управляет участниками и аудитом, но не удаляет workspace', () => {
    expect(roleHasPermission('admin', 'members.invite')).toBe(true);
    expect(roleHasPermission('admin', 'members.role.update')).toBe(true);
    expect(roleHasPermission('admin', 'audit.view')).toBe(true);
    expect(roleHasPermission('admin', 'workspace.delete')).toBe(false);
  });

  it('каждая роль ссылается только на существующие права', () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it('никто не может назначить роль owner', () => {
    for (const role of ROLES) {
      expect(ASSIGNABLE_ROLES[role]).not.toContain('owner');
    }
  });

  it('admin не может назначить admin (только owner может)', () => {
    expect(ASSIGNABLE_ROLES.admin).not.toContain('admin');
    expect(ASSIGNABLE_ROLES.owner).toContain('admin');
  });
});
