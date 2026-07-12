import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { DbModule } from './db/db.module.js';
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

@Module({
  imports: [DbModule, StorageModule],
  controllers: [
    HealthController,
    AuthController,
    WorkspacesController,
    ProjectsController,
    AssetsController,
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
    { provide: VIRUS_SCANNER, useClass: StubVirusScanner },
  ],
})
export class AppModule {}
