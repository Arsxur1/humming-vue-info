import { spawn } from 'node:child_process';

export const FONT_FILE = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    const err: Buffer[] = [];
    proc.stderr.on('data', (c: Buffer) => err.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg exit ${code}: ${Buffer.concat(err).toString().slice(0, 800)}`),
        );
    });
  });
}

export function ffprobeDurationMs(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      file,
    ]);
    const out: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => out.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}`));
      resolve(Math.round(Number(Buffer.concat(out).toString().trim()) * 1000));
    });
  });
}

/** Экранирование текста для drawtext (спецсимволы filtergraph). */
export function escapeDrawtext(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\\\\\'")
    .replaceAll(':', '\\:')
    .replaceAll('%', '\\%')
    .replaceAll(',', '\\,')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
}
