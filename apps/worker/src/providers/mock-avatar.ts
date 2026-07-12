import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  AvatarDriveRequest,
  AvatarDriveResult,
  IAvatarDriver,
} from '@avatarstudio/shared';
import { escapeDrawtext, FONT_FILE, runFfmpeg } from '../ffmpeg.js';

/**
 * MockAvatarDriver (Этап 4): статичная видео-заглушка аватара с таймкодом —
 * тёмная плашка, имя аватара и бегущий pts, чтобы в финальном MP4 было
 * видно синхронность склейки.
 */
export class MockAvatarDriver implements IAvatarDriver {
  readonly name = 'mock-avatar';

  async drive(request: AvatarDriveRequest): Promise<AvatarDriveResult> {
    const dir = await mkdtemp(path.join(tmpdir(), 'mock-avatar-'));
    try {
      const out = path.join(dir, 'avatar.mp4');
      const durSec = (request.durationMs / 1000).toFixed(3);
      const label = escapeDrawtext(`AVATAR ${request.avatarId ?? 'stock'}`);
      const vf = [
        `drawtext=fontfile=${FONT_FILE}:text='${label}':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=h/2-26`,
        `drawtext=fontfile=${FONT_FILE}:text='%{pts\\:hms}':fontcolor=yellow:fontsize=20:x=(w-text_w)/2:y=h/2+8`,
      ].join(',');
      await runFfmpeg([
        '-f', 'lavfi',
        '-i', `color=c=0x2E4057:s=${request.width}x${request.height}:d=${durSec}:r=${request.fps}`,
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        out,
      ]);
      return { video: await readFile(out), mime: 'video/mp4' };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
