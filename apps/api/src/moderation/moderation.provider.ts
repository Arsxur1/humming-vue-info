import { Inject, Injectable } from '@nestjs/common';
import { moderationStoplist, type Db } from '@avatarstudio/db';
import { DB } from '../db/client.js';

export interface ModerationResult {
  verdict: 'allow' | 'block' | 'review';
  category?: string;
  matchedTerm?: string;
}

/** Контракт модерации (Этап 5). Реализации не знает бизнес-логика рендера. */
export interface IModerationProvider {
  check(text: string): Promise<ModerationResult>;
}

export const MODERATION_PROVIDER = Symbol('MODERATION_PROVIDER');

/**
 * LLM-judge (FR-11.2) — заглушка: пропускает всё и логирует. Реальный вызов
 * LLM-API подключается за этим же интерфейсом, когда появится ключ (Этап 7).
 */
export class StubLlmJudge implements IModerationProvider {
  async check(text: string): Promise<ModerationResult> {
    console.log(`[moderation:llm-stub] allow (${text.length} симв.)`);
    return { verdict: 'allow' };
  }
}

/** Стоп-словарь из БД: подстрочное совпадение после нормализации. Кэш 60 с. */
@Injectable()
export class StopListModerationProvider implements IModerationProvider {
  private cache: Array<{ term: string; category: string; action: 'block' | 'review' }> = [];
  private cacheAt = 0;

  constructor(@Inject(DB) private readonly db: Db) {}

  async check(text: string): Promise<ModerationResult> {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    for (const entry of await this.terms()) {
      if (normalized.includes(entry.term)) {
        return {
          verdict: entry.action,
          category: entry.category,
          matchedTerm: entry.term,
        };
      }
    }
    return { verdict: 'allow' };
  }

  private async terms() {
    if (Date.now() - this.cacheAt > 60_000) {
      const rows = await this.db.select().from(moderationStoplist);
      this.cache = rows.map((r) => ({
        term: r.term.toLowerCase(),
        category: r.category,
        action: r.action,
      }));
      this.cacheAt = Date.now();
    }
    return this.cache;
  }
}

/** Композиция: стоп-словарь → LLM-judge. Блокировка сильнее ревью, ревью сильнее allow. */
@Injectable()
export class CompositeModerationProvider implements IModerationProvider {
  constructor(
    @Inject(StopListModerationProvider) private readonly stopList: StopListModerationProvider,
    private readonly llmJudge: IModerationProvider = new StubLlmJudge(),
  ) {}

  async check(text: string): Promise<ModerationResult> {
    const fromList = await this.stopList.check(text);
    if (fromList.verdict === 'block') return fromList;
    const fromJudge = await this.llmJudge.check(text);
    if (fromJudge.verdict === 'block') return fromJudge;
    if (fromList.verdict === 'review') return fromList;
    return fromJudge;
  }
}
