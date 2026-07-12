import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { requestUploadSchema, type RequestUploadDto } from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { AssetsService } from './assets.service.js';

@Controller('workspaces/:workspaceId/assets')
@UseGuards(AuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}

  @Post('uploads')
  @RequirePermission('asset.upload')
  requestUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(requestUploadSchema)) dto: RequestUploadDto,
  ) {
    return this.assets.requestUpload(workspaceId, dto, user);
  }

  @Post(':assetId/complete')
  @RequirePermission('asset.upload')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.assets.complete(workspaceId, assetId, user);
  }

  @Get()
  @RequirePermission('project.view')
  list(@Param('workspaceId') workspaceId: string) {
    return this.assets.list(workspaceId);
  }
}
