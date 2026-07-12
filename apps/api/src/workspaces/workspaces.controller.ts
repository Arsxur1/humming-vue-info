import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceDto,
  type InviteMemberDto,
  type UpdateWorkspaceDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard, type MembershipRequest } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { AuditService } from '../audit/audit.service.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseGuards(AuthGuard, PermissionsGuard)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Patch(':workspaceId')
  @RequirePermission('workspace.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(workspaceId, dto, user);
  }

  @Get(':workspaceId/members')
  @RequirePermission('members.view')
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Post(':workspaceId/invitations')
  @RequirePermission('members.invite')
  invite(
    @Req() req: MembershipRequest,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) dto: InviteMemberDto,
  ) {
    return this.workspaces.invite(workspaceId, dto, req.user, req.membership.role);
  }

  @Get(':workspaceId/audit-log')
  @RequirePermission('audit.view')
  auditLog(@Param('workspaceId') workspaceId: string) {
    return this.audit.listForWorkspace(workspaceId);
  }
}
