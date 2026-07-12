# AvatarStudio — dev-образ «всё в одном» (web + api + worker).
# Для тех, у кого нет Node/pnpm/ffmpeg: нужен только Docker.
#   docker compose --profile app up --build
FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 5173 3001
CMD ["pnpm", "dev:all"]
