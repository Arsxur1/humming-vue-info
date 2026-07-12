import { z } from 'zod';

/** Категории шаблонов (D2 — доменные пакеты; полный список FR-6.1 — по мере наполнения). */
export const TEMPLATE_CATEGORIES = [
  'learning',
  'compliance',
  'onboarding',
  'sales',
  'marketing',
  'social',
  'news',
  'product',
  'hr',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  learning: 'Обучение и L&D',
  compliance: 'Комплаенс',
  onboarding: 'Онбординг',
  sales: 'Продажи',
  marketing: 'Маркетинг',
  social: 'Соцсети',
  news: 'Новости',
  product: 'Продуктовые демо',
  hr: 'HR',
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Плейсхолдеры вида {{first_name}} из текста (FR-6.2). */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    found.add(match[1]!);
  }
  return [...found];
}

/** Подстановка переменных; неизвестные плейсхолдеры остаются как есть. */
export function applyVariables(text: string, variables: Record<string, string>): string {
  return text.replace(PLACEHOLDER_PATTERN, (whole, name: string) =>
    name in variables ? variables[name]! : whole,
  );
}

export const createTemplateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, 'Укажите название шаблона').max(200),
  category: z.enum(TEMPLATE_CATEGORIES),
  description: z.string().max(500).optional(),
});
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const instantiateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  variables: z.record(z.string().max(500)).default({}),
});
export type InstantiateTemplateDto = z.infer<typeof instantiateTemplateSchema>;
