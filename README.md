# AvatarStudio

Облачная платформа генерации видео с ИИ-аватарами (класс HeyGen). Монорепо на pnpm workspaces.

> **Быстрый запуск для новичка:** [`docs/ИНСТРУКЦИЯ_ДЛЯ_НОВИЧКА.md`](docs/ИНСТРУКЦИЯ_ДЛЯ_НОВИЧКА.md) — одна программа, одна команда.
> **Для разработчика:** [`docs/QUICKSTART.md`](docs/QUICKSTART.md).

## Что это

Текст → видео с говорящим аватаром, с редактором сцен, разметкой подачи речи
(Director Markup), C2PA-маркировкой, модерацией и шарингом. Сейчас ML-ядро
работает на **mock-провайдерах** (реальный пайплайн, но плашка вместо аватара
и тишина вместо голоса); реальные TTS/аватар подключаются за интерфейсами
`ITTSProvider` / `IAvatarDriver` без переписывания.

- Полное ТЗ: [`docs/TZ_AvatarStudio_v2.md`](docs/TZ_AvatarStudio_v2.md)
- Критика ТЗ и решения: [`docs/Критика_ТЗ.md`](docs/Критика_ТЗ.md)
- План этапов: [`docs/PLAN.md`](docs/PLAN.md)
- Инструкции для Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Структура монорепо

| Пакет | Назначение |
|---|---|
| `apps/web` | React + Vite + TS — SPA-редактор (PixiJS-canvas) |
| `apps/api` | NestJS — REST API, WebSocket прогресса, миграции, сиды |
| `apps/worker` | BullMQ-консьюмер — DAG рендера (TTS → липсинк → композитинг → C2PA) |
| `packages/shared` | Общие типы, zod-схемы, RBAC-матрица, оценка стоимости, утилиты |
| `packages/db` | Drizzle ORM: схема, кредиты, события рендера |
| `packages/storage` | Контракт хранилища + драйверы S3/MinIO и файловый |
| `packages/director-markup` | Парсер разметки подачи речи (дифференциатор D1) |

## Запуск (разработка)

```bash
pnpm install
docker compose up -d postgres redis
pnpm dev:all        # web :5173 + api :3001 + worker
```

Или всё в Docker одной командой: `docker compose --profile app up --build`.

## Команды

```bash
pnpm dev:all     # web + api + worker
pnpm lint
pnpm typecheck
pnpm test        # unit + integration (нужны Postgres и Redis)
pnpm --filter @avatarstudio/web e2e   # Playwright (нужны ffmpeg + Chromium)
bash scripts/doctor.sh                 # проверка окружения
```

## Статус

Реализованы этапы 0–6 и 9 по `docs/PLAN.md`: auth/RBAC, парсер Director Markup,
модель данных, рендер-пайплайн с кэшем сцен и кредитами, C2PA + модерация +
шаринг, редактор, шаблоны. Плюс боевая готовность авторизации (реальная почта,
сброс пароля, 2FA, лимиты). Этапы 7 (реальные провайдеры) и 8 (Stripe) требуют
внешних ключей.

## Legacy

Каталог [`legacy-hfo/`](legacy-hfo/) — не относящийся к AvatarStudio контент
(обучающее приложение по HFO-вентиляции), сохранён для истории. К сборке и
тестам не подключён.
