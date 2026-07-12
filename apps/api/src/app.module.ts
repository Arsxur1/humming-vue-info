import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { DbModule } from './db/db.module.js';
import { MailerService } from './mailer/mailer.service.js';
import { AuditService } from './audit/audit.service.js';
import { TokensService } from './auth/tokens.service.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { WorkspacesService } from './workspaces/workspaces.service.js';
import { WorkspacesController } from './workspaces/workspaces.controller.js';

@Module({
  imports: [DbModule],
  controllers: [HealthController, AuthController, WorkspacesController],
  providers: [MailerService, AuditService, TokensService, AuthService, WorkspacesService],
})
export class AppModule {}
