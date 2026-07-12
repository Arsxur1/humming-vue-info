import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  resolveModerationCaseSchema,
  type ResolveModerationCaseDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { ModerationService } from './moderation.service.js';

@Controller('workspaces/:workspaceId/moderation')
@UseGuards(AuthGuard, PermissionsGuard)
export class ModerationController {
  constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Get('cases')
  @RequirePermission('moderation.review')
  list(
    @Param('workspaceId') workspaceId: string,
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
  ) {
    return this.moderation.listCases(workspaceId, status);
  }

  @Post('cases/:caseId/resolve')
  @HttpCode(200)
  @RequirePermission('moderation.review')
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(resolveModerationCaseSchema)) dto: ResolveModerationCaseDto,
  ) {
    return this.moderation.resolve(workspaceId, caseId, dto, user);
  }
}
