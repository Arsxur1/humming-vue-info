import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createTemplateSchema,
  instantiateTemplateSchema,
  type CreateTemplateDto,
  type InstantiateTemplateDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { TemplatesService } from './templates.service.js';

@Controller('workspaces/:workspaceId/templates')
@UseGuards(AuthGuard, PermissionsGuard)
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly templates: TemplatesService) {}

  @Get()
  @RequirePermission('project.view')
  list(@Param('workspaceId') workspaceId: string) {
    return this.templates.list(workspaceId);
  }

  @Post()
  @RequirePermission('project.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.templates.createFromProject(workspaceId, dto, user);
  }

  @Post(':templateId/instantiate')
  @HttpCode(201)
  @RequirePermission('project.create')
  instantiate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(instantiateTemplateSchema)) dto: InstantiateTemplateDto,
  ) {
    return this.templates.instantiate(workspaceId, templateId, dto, user);
  }

  @Delete(':templateId')
  @RequirePermission('project.delete')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templates.remove(workspaceId, templateId, user);
  }
}
