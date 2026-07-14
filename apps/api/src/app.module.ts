import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { DbModule } from './db/db.module.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadsController } from './storage/uploads.controller.js';
import { MailerService } from './mailer/mailer.service.js';
import { AuditService } from './audit/audit.service.js';
import { TokensService } from './auth/tokens.service.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { WorkspacesService } from './workspaces/workspaces.service.js';
import { WorkspacesController } from './workspaces/workspaces.controller.js';
import { ProjectsService } from './projects/projects.service.js';
import { ProjectsController } from './projects/projects.controller.js';
import { AssetsService } from './assets/assets.service.js';
import { AssetsController } from './assets/assets.controller.js';
import { PreviewService } from './assets/preview.service.js';
import { StubVirusScanner, VIRUS_SCANNER } from './assets/virus-scanner.js';
import { QueueModule } from './queue/queue.module.js';
import { RendersService } from './renders/renders.service.js';
import { RendersController } from './renders/renders.controller.js';
import {
  CompositeModerationProvider,
  MODERATION_PROVIDER,
  StopListModerationProvider,
} from './moderation/moderation.provider.js';
import { ModerationService } from './moderation/moderation.service.js';
import { ModerationController } from './moderation/moderation.controller.js';
import { SharesService } from './shares/shares.service.js';
import { PublicShareController, SharesController } from './shares/shares.controller.js';
import { TemplatesService } from './templates/templates.service.js';
import { TemplatesController } from './templates/templates.controller.js';

@Module({
  imports: [DbModule, StorageModule, QueueModule, RateLimitModule],
  controllers: [
    HealthController,
    AuthController,
    WorkspacesController,
    ProjectsController,
    AssetsController,
    RendersController,
    ModerationController,
    SharesController,
    PublicShareController,
    TemplatesController,
    UploadsController,
  ],
  providers: [
    MailerService,
    AuditService,
    TokensService,
    AuthService,
    WorkspacesService,
    ProjectsService,
    AssetsService,
    PreviewService,
    RendersService,
    StopListModerationProvider,
    { provide: MODERATION_PROVIDER, useClass: CompositeModerationProvider },
    ModerationService,
    SharesService,
    TemplatesService,
    { provide: VIRUS_SCANNER, useClass: StubVirusScanner },
  ],
})
export class AppModule {}
