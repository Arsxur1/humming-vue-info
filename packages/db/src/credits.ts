import { eq, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { creditTransactions, renderJobs, workspaces } from './schema.js';

/**
 * Кредиты (правило 4 CLAUDE.md): резервирование при постановке в очередь,
 * автовозврат при сбое/отмене, списание только по факту done.
 * Все операции — в транзакции с блокировкой строки workspace/job.
 */

export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly required: number,
  ) {
    super(
      `Недостаточно кредитов: нужно ${required.toFixed(2)}, на балансе ${balance.toFixed(2)}. Пополните баланс или уменьшите длительность/качество.`,
    );
    this.name = 'InsufficientCreditsError';
  }
}

export async function reserveCredits(
  db: Db,
  args: { workspaceId: string; userId: string; jobId: string; amount: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [ws] = await tx
      .select({ balance: workspaces.creditsBalance })
      .from(workspaces)
      .where(eq(workspaces.id, args.workspaceId))
      .for('update');
    const balance = Number(ws?.balance ?? 0);
    if (balance < args.amount) throw new InsufficientCreditsError(balance, args.amount);
    await tx
      .update(workspaces)
      .set({ creditsBalance: sql`${workspaces.creditsBalance} - ${args.amount.toFixed(2)}` })
      .where(eq(workspaces.id, args.workspaceId));
    await tx.insert(creditTransactions).values({
      workspaceId: args.workspaceId,
      userId: args.userId,
      delta: (-args.amount).toFixed(2),
      reason: 'reserve',
      jobId: args.jobId,
    });
  });
}

export type JobOutcome = 'done' | 'failed' | 'cancelled';

export interface FinalizeOptions {
  errorCode?: string;
  errorMessage?: string;
  outputKey?: string;
  durationMs?: number;
  /** Фактическая стоимость (для done); списываем min(actual, reserved), разницу возвращаем. */
  actualCost?: number;
  meta?: Record<string, unknown>;
}

/**
 * Единственная точка финализации джоба (идемпотентна): переводит в терминальный
 * статус, списывает/возвращает кредиты. Возвращает null, если джоб уже терминален.
 */
export async function finalizeRenderJob(
  db: Db,
  jobId: string,
  outcome: JobOutcome,
  opts: FinalizeOptions = {},
): Promise<typeof renderJobs.$inferSelect | null> {
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(renderJobs).where(eq(renderJobs.id, jobId)).for('update');
    if (!job || ['done', 'failed', 'cancelled'].includes(job.status)) return null;

    const reserved = Number(job.creditsReserved);
    const charge =
      outcome === 'done' ? Math.min(opts.actualCost ?? reserved, reserved) : 0;
    const refund = reserved - charge;

    if (refund > 0.004) {
      await tx
        .update(workspaces)
        .set({ creditsBalance: sql`${workspaces.creditsBalance} + ${refund.toFixed(2)}` })
        .where(eq(workspaces.id, job.workspaceId));
      await tx.insert(creditTransactions).values({
        workspaceId: job.workspaceId,
        userId: job.requestedBy,
        delta: refund.toFixed(2),
        reason: outcome === 'done' ? 'refund_diff' : 'refund',
        jobId,
      });
    }

    const [updated] = await tx
      .update(renderJobs)
      .set({
        status: outcome,
        stage: outcome === 'done' ? 'done' : job.stage,
        progress: outcome === 'done' ? 1 : job.progress,
        errorCode: opts.errorCode ?? null,
        errorMessage: opts.errorMessage ?? null,
        outputKey: opts.outputKey ?? job.outputKey,
        durationMs: opts.durationMs ?? job.durationMs,
        creditsCharged: charge.toFixed(2),
        meta: opts.meta ?? job.meta,
        finishedAt: new Date(),
      })
      .where(eq(renderJobs.id, jobId))
      .returning();
    return updated ?? null;
  });
}
