/** Поднимает api + worker для Playwright (готовность проверяется по /api/health). */
import process from 'node:process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tsx = path.resolve(here, '../node_modules/.bin/tsx');
const apiEntry = path.resolve(here, '../../api/src/main.ts');
const workerEntry = path.resolve(here, '../../worker/src/main.ts');

const env = { ...process.env };

// cwd важен: tsx берёт tsconfig из рабочего каталога (декораторы NestJS)
const api = spawn(tsx, [apiEntry], { stdio: 'inherit', env, cwd: path.dirname(path.dirname(apiEntry)) });
const worker = spawn(tsx, [workerEntry], { stdio: 'inherit', env, cwd: path.dirname(path.dirname(workerEntry)) });

function shutdown() {
  api.kill('SIGTERM');
  worker.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
api.on('exit', (code) => {
  if (code) process.exit(code);
});
