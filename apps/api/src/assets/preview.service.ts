import { spawn } from 'node:child_process';
import { Inject, Injectable } from '@nestjs/common';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';

/**
 * Превью изображений: ffmpeg через pipe (без временных файлов),
 * масштабирование до ширины ≤ 512, JPEG.
 */
@Injectable()
export class PreviewService {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async createImagePreview(sourceKey: string, previewKey: string): Promise<void> {
    const source = await this.storage.read(sourceKey);
    const preview = await runFfmpeg(source, [
      '-i', 'pipe:0',
      '-vf', "scale='min(512,iw)':-2",
      '-frames:v', '1',
      '-f', 'mjpeg',
      'pipe:1',
    ]);
    await this.storage.write(previewKey, preview, 'image/jpeg');
  }
}

function runFfmpeg(input: Buffer, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => out.push(c));
    proc.stderr.on('data', (c: Buffer) => err.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(err).toString().slice(0, 500)}`));
    });
    proc.stdin.on('error', () => {}); // EPIPE при раннем выходе ffmpeg
    proc.stdin.end(input);
  });
}
