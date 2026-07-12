import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { roleHasPermission, type Permission, type Role } from '@avatarstudio/shared';
import { DB, type Db } from '../db/client.js';
import { workspaceMembers, workspaces } from '../db/schema.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { PERMISSION_KEY } from './require-permission.decorator.js';

export interface MembershipRequest extends AuthenticatedRequest {
  membership: { workspaceId: string; role: Role };
}

/**
 * Проверяет право из @RequirePermission по матрице ROLE_PERMISSIONS (данные,
 * не if-ы). Ставится ПОСЛЕ AuthGuard; берёт :workspaceId из параметров пути.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<MembershipRequest>();
    const workspaceId = req.params.workspaceId;
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      throw new Error('PermissionsGuard требует параметр пути :workspaceId');
    }

    const workspace = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });
    if (!workspace) {
      throw new NotFoundException({
        error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace не найден или удалён.' },
      });
    }

    const membership = await this.db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, req.user.id),
      ),
    });
    if (!membership) {
      throw new ForbiddenException({
        error: {
          code: 'NOT_A_MEMBER',
          message: 'Вы не участник этого workspace. Попросите администратора пригласить вас.',
        },
      });
    }

    if (!roleHasPermission(membership.role, required)) {
      throw new ForbiddenException({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Ваша роль (${membership.role}) не позволяет это действие. Попросите Owner или Admin выполнить его или повысить вашу роль.`,
          details: { required },
        },
      });
    }

    req.membership = { workspaceId, role: membership.role };
    return true;
  }
}
