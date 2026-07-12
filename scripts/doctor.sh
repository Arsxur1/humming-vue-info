#!/usr/bin/env bash
# Диагностика окружения для запуска AvatarStudio.
# Запуск из корня репозитория:  bash scripts/doctor.sh
set -u

ok=0; fail=0
pass() { echo "  ✅ $1"; ok=$((ok+1)); }
warn() { echo "  ⚠️  $1"; }
bad()  { echo "  ❌ $1"; fail=$((fail+1)); }

echo "== AvatarStudio doctor =="
echo
echo "ОС: $(uname -s) $(uname -m 2>/dev/null || true)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) warn "Windows без WSL: запускайте из WSL2 (Ubuntu) или через Docker" ;;
esac
echo

echo "-- Node.js --"
if command -v node >/dev/null 2>&1; then
  v=$(node -v | sed 's/v//; s/\..*//')
  if [ "$v" -ge 22 ]; then pass "node $(node -v)"; else bad "node $(node -v) — нужен ≥ 22. Обновите: https://nodejs.org или nvm install 22"; fi
else
  bad "node не найден. Установите Node.js 22: https://nodejs.org (или используйте Docker-вариант)"
fi

echo "-- pnpm --"
if command -v pnpm >/dev/null 2>&1; then
  pass "pnpm $(pnpm -v)"
else
  bad "pnpm не найден. Установите:  npm i -g pnpm   (или: corepack enable)"
fi

echo "-- Docker (для Postgres/Redis) --"
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    pass "docker работает"
  else
    bad "docker установлен, но демон не запущен. Запустите Docker Desktop (или: sudo systemctl start docker)"
  fi
else
  bad "docker не найден. Установите Docker Desktop: https://docs.docker.com/get-docker/"
fi

echo "-- ffmpeg (рендер видео) --"
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  pass "$(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f1-3)"
else
  bad "ffmpeg/ffprobe не найдены. Ubuntu/WSL: sudo apt install ffmpeg fonts-dejavu-core; macOS: brew install ffmpeg"
fi

echo "-- шрифты DejaVu (drawtext/субтитры) --"
if [ -f /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf ] || fc-list 2>/dev/null | grep -qi dejavu; then
  pass "DejaVu найден"
else
  warn "DejaVu не найден: sudo apt install fonts-dejavu-core (без него не отрисуются тексты в видео)"
fi

echo "-- openssl (dev-TSA для C2PA) --"
if command -v openssl >/dev/null 2>&1; then pass "openssl $(openssl version | cut -d' ' -f2)"; else bad "openssl не найден: sudo apt install openssl"; fi

echo "-- порты --"
for p in 5432 6379 3001 5173; do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "порт $p занят — если это не наши сервисы, остановите процесс или поменяйте порт"
  else
    pass "порт $p свободен"
  fi
done

echo -- зависимости --
if [ -d node_modules ]; then pass "node_modules установлены"; else warn "запустите: pnpm install"; fi

echo
if [ "$fail" -eq 0 ]; then
  cat <<'NEXT'
Всё готово. Запуск:
  pnpm install
  docker compose up -d postgres redis
  pnpm dev:all
Открыть: http://localhost:5173

Если что-то не поднимется — пришлите вывод команды целиком.
NEXT
else
  echo "Найдено проблем: $fail. Исправьте пункты с ❌ выше и запустите doctor снова."
  echo "Либо запустите всё через Docker одной командой (нужен только Docker):"
  echo "  docker compose --profile app up --build"
fi
