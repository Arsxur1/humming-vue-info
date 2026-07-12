import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createRenderJobSchema, type CreateRenderJobDto } from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { RendersService } from './renders.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, PermissionsGuard)
export class RendersController {
  constructor(@Inject(RendersService) private readonly renders: RendersService) {}

  @Post('projects/:projectId/renders')
  @RequirePermission('render.start')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createRenderJobSchema)) dto: CreateRenderJobDto,
  ) {
    return this.renders.create(workspaceId, projectId, dto, user);
  }

  @Post('projects/:projectId/scenes/:sceneId/preview')
  @RequirePermission('render.start')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string,
  ) {
    return this.renders.createScenePreview(workspaceId, projectId, sceneId, user);
  }

  @Get('projects/:projectId/renders')
  @RequirePermission('project.view')
  list(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.renders.listForProject(workspaceId, projectId);
  }

  @Get('renders/:jobId')
  @RequirePermission('project.view')
  get(@Param('workspaceId') workspaceId: string, @Param('jobId') jobId: string) {
    return this.renders.get(workspaceId, jobId);
  }

  @Get('renders/:jobId/events')
  @RequirePermission('project.view')
  events(@Param('workspaceId') workspaceId: string, @Param('jobId') jobId: string) {
    return this.renders.listEvents(workspaceId, jobId);
  }

  @Post('renders/:jobId/cancel')
  @HttpCode(200)
  @RequirePermission('render.cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.renders.cancel(workspaceId, jobId, user);
  }
}
