import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@avatarstudio/shared';

export const PERMISSION_KEY = 'required_permission';

/** Помечает эндпоинт требуемым правом; проверку выполняет PermissionsGuard. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
