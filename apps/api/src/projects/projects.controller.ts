import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createProjectSchema,
  createSceneSchema,
  reorderScenesSchema,
  updateProjectSchema,
  updateSceneSchema,
  type CreateProjectDto,
  type CreateSceneDto,
  type ReorderScenesDto,
  type UpdateProjectDto,
  type UpdateSceneDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { ProjectsService } from './projects.service.js';

@Controller('workspaces/:workspaceId/projects')
@UseGuards(AuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  @RequirePermission('project.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    return this.projects.create(workspaceId, dto, user);
  }

  @Get()
  @RequirePermission('project.view')
  list(@Param('workspaceId') workspaceId: string) {
    return this.projects.list(workspaceId);
  }

  @Get(':projectId')
  @RequirePermission('project.view')
  get(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.projects.get(workspaceId, projectId);
  }

  @Patch(':projectId')
  @RequirePermission('project.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, projectId, dto, user);
  }

  @Delete(':projectId')
  @RequirePermission('project.delete')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.remove(workspaceId, projectId, user);
  }

  // ---------- Сцены ----------

  @Post(':projectId/scenes')
  @RequirePermission('project.update')
  createScene(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createSceneSchema)) dto: CreateSceneDto,
  ) {
    return this.projects.createScene(workspaceId, projectId, dto, user);
  }

  @Patch(':projectId/scenes/:sceneId')
  @RequirePermission('project.update')
  updateScene(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string,
    @Body(new ZodValidationPipe(updateSceneSchema)) dto: UpdateSceneDto,
  ) {
    return this.projects.updateScene(workspaceId, projectId, sceneId, dto, user);
  }

  @Delete(':projectId/scenes/:sceneId')
  @RequirePermission('project.update')
  removeScene(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sceneId') sceneId: string,
  ) {
    return this.projects.removeScene(workspaceId, projectId, sceneId, user);
  }

  @Post(':projectId/scenes/reorder')
  @HttpCode(200)
  @RequirePermission('project.update')
  reorder(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(reorderScenesSchema)) dto: ReorderScenesDto,
  ) {
    return this.projects.reorderScenes(workspaceId, projectId, dto);
  }

  // ---------- Версии ----------

  @Post(':projectId/versions')
  @RequirePermission('project.update')
  snapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.createSnapshot(workspaceId, projectId, user);
  }

  @Get(':projectId/versions')
  @RequirePermission('project.view')
  versions(@Param('workspaceId') workspaceId: string, @Param('projectId') projectId: string) {
    return this.projects.listVersions(workspaceId, projectId);
  }

  @Post(':projectId/versions/:versionId/restore')
  @HttpCode(200)
  @RequirePermission('project.update')
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projects.restoreVersion(workspaceId, projectId, versionId, user);
  }

  @Get(':projectId/versions/:versionId/diff')
  @RequirePermission('project.view')
  diff(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projects.diffVersion(workspaceId, projectId, versionId);
  }
}
