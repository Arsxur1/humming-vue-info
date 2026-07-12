# AvatarStudio — быстрый запуск (тестовый режим)

Код лежит в ветке `claude/stage-0-setup-qnpv9l`. MVP работает целиком на
mock-провайдерах: реальный интерфейс, реальный пайплайн, реальные MP4 —
но вместо живого аватара в видео плашка-заглушка, вместо речи тишина
с субтитрами (реальные TTS/аватар подключаются на Этапе 7 за теми же
интерфейсами).

## Шаг 0 — диагностика

Клонируйте репозиторий и запустите проверку окружения — она скажет,
чего не хватает, и как это поставить:

```bash
git clone https://github.com/Arsxur1/humming-vue-info.git
cd humming-vue-info
git checkout claude/stage-0-setup-qnpv9l
bash scripts/doctor.sh
```

## Требования (вариант A — основной, проверенный)

- Node.js ≥ 22 и pnpm ≥ 10 (`npm i -g pnpm`)
- Docker (для Postgres и Redis)
- ffmpeg и шрифты DejaVu: `sudo apt install ffmpeg fonts-dejavu-core`
  (macOS: `brew install ffmpeg`)
- openssl (обычно уже есть; нужен встроенному dev-TSA для C2PA-подписи)
- Windows — только через WSL2 (Ubuntu из Microsoft Store).

## Запуск (вариант A)

```bash
pnpm install
docker compose up -d postgres redis   # MinIO не обязателен: по умолчанию STORAGE_DRIVER=fs
pnpm dev:all                          # web (5173) + api (3001) + worker
```

## Запуск (вариант B — только Docker, ничего больше ставить не нужно)

```bash
docker compose --profile app up --build
```

Соберётся образ со всем внутри (Node, ffmpeg, зависимости) и поднимется
вместе с Postgres и Redis. Первая сборка занимает несколько минут.
[не проверено в среде разработки — там закрыт Docker-реестр; Dockerfile
стандартный, на обычной машине с Docker Desktop должно работать.
Если не заработает — пришлите вывод, починим.]

Откройте **http://localhost:5173** → регистрация (любой e-mail, письма
логируются в консоль api) → создайте проект или возьмите один из 12
шаблонов → отредактируйте сцены → «Рендер» → скачайте MP4 из плеера.

Миграции БД и сиды шаблонов применяются автоматически при старте api.
Файлы хранилища — в `.data/storage/` в корне репозитория.

## Частые проблемы

| Симптом | Причина и лечение |
|---|---|
| `node: command not found` / версия < 22 | Поставьте Node 22: https://nodejs.org, либо `nvm install 22 && nvm use 22` |
| `pnpm: command not found` | `npm i -g pnpm` (или `corepack enable`) |
| `Cannot connect to the Docker daemon` | Запустите Docker Desktop; в Linux: `sudo systemctl start docker` |
| `port is already allocated` (5432/6379) | На машине уже крутится Postgres/Redis. Остановите их или поменяйте левую часть портов в docker-compose.yml (например `15432:5432`) и `DATABASE_URL` в `.env` |
| `Ignored build scripts…` при `pnpm install` | Выполните `pnpm approve-builds` и разрешите esbuild, c2pa-node, sharp, msgpackr-extract |
| Рендер падает, в логе worker `ffmpeg: not found` | `sudo apt install ffmpeg fonts-dejavu-core` |
| Письмо верификации «не приходит» | Это нормально: SMTP нет, токен печатается в консоли api (`[mailer] → …`) |
| Windows: скрипты не запускаются | Работайте из WSL2, не из PowerShell |

Если не помогло — пришлите: (1) ОС, (2) команду, на которой остановились,
(3) полный текст ошибки. Этого достаточно, чтобы починить.

## Проверка, что всё живо

```bash
curl http://localhost:3001/api/health   # {"status":"ok",...}
pnpm test                               # 128 тестов
pnpm --filter @avatarstudio/web e2e     # Playwright-сценарий редактора
```

## Что уже работает (Этапы 0–6, 9)

- Auth (JWT + refresh), workspaces, роли Owner/Admin/Editor/Reviewer/Viewer
- Редактор: PixiJS-canvas (drag/resize, сетка, safe-zone), сцены, слои,
  кнопки Director Markup, мультиформат 16:9/9:16/1:1, автосохранение
- Рендер-пайплайн: очередь BullMQ, DAG до готового MP4 с burn-in
  субтитрами, прогресс по WebSocket, отмена с возвратом кредитов
- Scene-cache: правка 1 сцены из N пересчитывает только её
- Кредиты: резервирование → списание по факту → автовозврат при сбое
- C2PA-манифест в каждом видео (тестовый сертификат), реестр генераций
- Модерация скриптов (стоп-словарь + очередь ручной модерации)
- Шаринг по ссылке: public / password / members, TTL
- Шаблоны с плейсхолдерами {{var}}, 12 стартовых

## Что нужно для боевого запуска

| Что | Зачем | Кто даёт |
|---|---|---|
| Ключ TTS-провайдера (ElevenLabs/Azure-класс) | Реальная речь (Этап 7) | вы |
| Ключ avatar/lipsync API (HeyGen/D-ID-класс) | Реальный аватар (Этап 7) | вы |
| Ключи Stripe | Платежи (Этап 8) | вы |
| C2PA-сертификат + боевой TSA (`C2PA_*` env) | Подпись видео своим именем | вы/Adobe CAI |
| `JWT_SECRET`, домен, хостинг (VPS + docker), SMTP | Инфраструктура | вы |
| Библиотека аватаров и голосов, юр. документы (ToS, AUP), боевой стоп-лист модерации | Контент и право (ТЗ ч. 8, 10) | не разработка |
