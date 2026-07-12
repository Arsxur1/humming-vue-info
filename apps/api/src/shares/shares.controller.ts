import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  accessShareSchema,
  createShareSchema,
  type AccessShareDto,
  type CreateShareDto,
} from '@avatarstudio/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { RequirePermission } from '../rbac/require-permission.decorator.js';
import { TokensService } from '../auth/tokens.service.js';
import { SharesService } from './shares.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, PermissionsGuard)
export class SharesController {
  constructor(@Inject(SharesService) private readonly shares: SharesService) {}

  @Post('renders/:jobId/share')
  @RequirePermission('share.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(createShareSchema)) dto: CreateShareDto,
  ) {
    return this.shares.create(workspaceId, jobId, dto, user);
  }

  @Delete('shares/:shareId')
  @RequirePermission('share.create')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('shareId') shareId: string,
  ) {
    return this.shares.revoke(workspaceId, shareId, user);
  }
}

/** Публичные эндпоинты ссылки — без guard'ов; авторизация опциональна (members-ссылки). */
@Controller('share')
export class PublicShareController {
  constructor(
    @Inject(SharesService) private readonly shares: SharesService,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.shares.info(token);
  }

  @Post(':token/access')
  @HttpCode(200)
  async access(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(accessShareSchema)) dto: AccessShareDto,
    @Req() req: Request,
  ) {
    const header = req.headers.authorization;
    const raw = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const payload = raw ? await this.tokens.verifyAccessToken(raw) : null;
    const user = payload ? { id: payload.sub, email: payload.email } : null;
    return this.shares.access(token, dto.password, user);
  }
}
