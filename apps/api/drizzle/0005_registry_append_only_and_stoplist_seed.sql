-- generation_registry — append-only (FR-11.5): реестр нельзя переписать.
CREATE OR REPLACE FUNCTION forbid_generation_registry_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'generation_registry is append-only: % is forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER generation_registry_append_only
  BEFORE UPDATE OR DELETE ON "generation_registry"
  FOR EACH ROW EXECUTE FUNCTION forbid_generation_registry_mutation();
--> statement-breakpoint
-- Сиды стоп-словаря (FR-11.2). Механизм — здесь; полноценный список — задача
-- trust&safety с юристом (см. Критика ТЗ, вопрос 12). Термины ниже — примеры категорий.
INSERT INTO "moderation_stoplist" ("term", "category", "action") VALUES
  ('гарантированный доход без риска', 'financial_fraud', 'block'),
  ('переведите деньги на этот кошелёк', 'financial_fraud', 'block'),
  ('выборы сфальсифицированы', 'election_disinfo', 'block'),
  ('лекарство скрывают от вас', 'health_disinfo', 'review'),
  ('инвестируйте всё сегодня', 'financial_fraud', 'review');
