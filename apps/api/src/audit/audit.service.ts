import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/client.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Только запись — таблица append-only (UPDATE/DELETE запрещены триггером). */
  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      workspaceId: entry.workspaceId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? {},
    });
  }

  async listForWorkspace(workspaceId: string, limit = 100) {
    return this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.workspaceId, workspaceId))
      .orderBy(desc(auditLog.id))
      .limit(limit);
  }
}
