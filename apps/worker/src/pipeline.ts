import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import {
  layers as layersTable,
  renderJobs,
  sceneRenderCache,
  scenes as scenesTable,
  finalizeRenderJob,
  recordRenderEvent,
  type Db,
  type RenderEventPublisher,
} from '@avatarstudio/db';
import type { ObjectStorage } from '@avatarstudio/storage';
import {
  creditCost,
  frameSize,
  type IAvatarDriver,
  type ITTSProvider,
  type RenderQuality,
  type WordTiming,
} from '@avatarstudio/shared';
import { sceneContentHash } from '@avatarstudio/shared/scene-hash';
import {
  compileToGestureCues,
  compileToPlainText,
  compileToSSML,
  safeParse,
} from '@avatarstudio/director-markup';
import { escapeDrawtext, ffprobeDurationMs, FONT_FILE, runFfmpeg } from './ffmpeg.js';
import { alignmentToSrt } from './subtitles.js';

/** Постоянная ошибка — ретраи бессмысленны (битый скрипт, пустой проект). */
export class PermanentRenderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PermanentRenderError';
  }
}

/** Джоб отменён пользователем — тихо выходим (финализировал уже api). */
export class JobCancelledError extends Error {
  constructor() {
    super('job cancelled');
    this.name = 'JobCancelledError';
  }
}

export interface PipelineContext {
  db: Db;
  storage: ObjectStorage;
  publisher: RenderEventPublisher;
  tts: ITTSProvider;
  avatar: IAvatarDriver;
}

export async function processRenderJob(ctx: PipelineContext, jobId: string): Promise<void> {
  const { db, storage, publisher } = ctx;

  const job = await db.query.renderJobs.findFirst({ where: eq(renderJobs.id, jobId) });
  if (!job) return;
  if (['cancelled', 'done', 'failed'].includes(job.status)) return;

  const event = (status: string, stage: string, progress: number, message?: string) =>
    recordRenderEvent(db, publisher, {
      jobId,
      workspaceId: job.workspaceId,
      status,
      stage,
      progress,
      message,
    });

  /**
   * Переход стадии. Условный UPDATE не трогает терминальные статусы —
   * иначе гонка с отменой «воскресила» бы cancelled-джоб. 0 строк = джоб
   * отменён/завершён конкурентно → прекращаем работу.
   */
  const setStage = async (stage: string, progress: number, message?: string) => {
    const updated = await db
      .update(renderJobs)
      .set({ stage, progress, status: 'running' })
      .where(
        and(
          eq(renderJobs.id, jobId),
          notInArray(renderJobs.status, ['done', 'failed', 'cancelled']),
        ),
      )
      .returning({ id: renderJobs.id });
    if (!updated.length) throw new JobCancelledError();
    await event('running', stage, progress, message);
  };

  const ensureNotCancelled = async () => {
    const fresh = await db.query.renderJobs.findFirst({
      columns: { status: true },
      where: eq(renderJobs.id, jobId),
    });
    if (fresh?.status === 'cancelled') throw new JobCancelledError();
  };

  if (job.status === 'queued') {
    await db
      .update(renderJobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(and(eq(renderJobs.id, jobId), eq(renderJobs.status, 'queued')));
  }

  // ---------- preprocessing ----------
  await setStage('preprocessing', 0.02);

  const sceneRows = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.projectId, job.projectId))
    .orderBy(asc(scenesTable.orderIndex));
  if (!sceneRows.length) {
    throw new PermanentRenderError('EMPTY_PROJECT', 'В проекте нет сцен — добавьте хотя бы одну.');
  }
  const layerRows = await db
    .select()
    .from(layersTable)
    .where(inArray(layersTable.sceneId, sceneRows.map((s) => s.id)))
    .orderBy(asc(layersTable.zIndex));

  const quality = job.quality as RenderQuality;
  const { width, height } = frameSize(job.aspectRatio, quality);
  const renderParams = { quality: job.quality, aspectRatio: job.aspectRatio };

  interface PreparedScene {
    row: typeof sceneRows[number];
    layers: typeof layerRows;
    plainText: string;
    ssml: string;
    cacheKey: string;
  }

  const prepared: PreparedScene[] = sceneRows.map((row, i) => {
    const parsed = safeParse(row.script);
    if (!parsed.success) {
      throw new PermanentRenderError(
        'INVALID_SCRIPT',
        `Сцена ${i + 1}: ${parsed.error.message} Исправьте разметку и запустите рендер снова.`,
      );
    }
    const sceneLayers = layerRows.filter((l) => l.sceneId === row.id);
    return {
      row,
      layers: sceneLayers,
      plainText: compileToPlainText(parsed.document),
      ssml: compileToSSML(parsed.document),
      cacheKey: sceneContentHash({
        script: row.script,
        voiceId: row.voiceId,
        avatarId: row.avatarId,
        layers: sceneLayers.map(({ id: _i, sceneId: _s, ...rest }) => rest),
        renderParams,
      }),
    };
  });

  // ---------- по сценам: cache | tts → lipsync → compositing ----------
  const segments: Array<{ key: string; durationMs: number }> = [];
  let cacheHits = 0;
  let rendered = 0;
  const total = prepared.length;

  for (const [i, scene] of prepared.entries()) {
    await ensureNotCancelled();
    const baseProgress = 0.05 + (i / total) * 0.85;

    const cached = await db.query.sceneRenderCache.findFirst({
      where: eq(sceneRenderCache.contentHash, scene.cacheKey),
    });
    if (cached) {
      cacheHits += 1;
      await db
        .update(sceneRenderCache)
        .set({ hits: sql`${sceneRenderCache.hits} + 1` })
        .where(eq(sceneRenderCache.contentHash, scene.cacheKey));
      segments.push({ key: cached.segmentKey, durationMs: cached.durationMs });
      await setStage('compositing', baseProgress, `сцена ${i + 1}/${total}: из кэша`);
      continue;
    }

    const renderStart = Date.now();
    await setStage('tts', baseProgress, `сцена ${i + 1}/${total}`);
    const parsed = safeParse(scene.row.script);
    const gestureCues = parsed.success ? compileToGestureCues(parsed.document) : [];
    const tts = await ctx.tts.synthesize({
      ssml: scene.ssml,
      plainText: scene.plainText,
      language: scene.row.language ?? 'ru',
      voiceId: scene.row.voiceId,
    });

    await ensureNotCancelled();
    await setStage('lipsync', baseProgress + 0.3 / total, `сцена ${i + 1}/${total}`);
    const avatarH = Math.round((height * 0.6) / 2) * 2;
    const avatarW = Math.round((avatarH * 9) / 16 / 2) * 2;
    const avatar = await ctx.avatar.drive({
      avatarId: scene.row.avatarId,
      audio: tts.audio,
      durationMs: tts.durationMs,
      width: avatarW,
      height: avatarH,
      fps: 25,
      gestureCues,
    });

    await ensureNotCancelled();
    await setStage('compositing', baseProgress + 0.6 / total, `сцена ${i + 1}/${total}`);
    const segment = await compositeScene({
      width,
      height,
      durationMs: tts.durationMs,
      background: scene.row.background as Record<string, unknown>,
      avatarVideo: avatar.video,
      audioWav: tts.audio,
      alignment: tts.alignment,
      textLayers: scene.layers
        .filter((l) => l.type === 'text')
        .map((l) => l.props as Record<string, unknown>),
    });

    const segmentKey = `render-segments/${scene.cacheKey}.mp4`;
    await storage.write(segmentKey, segment, 'video/mp4');
    await db
      .insert(sceneRenderCache)
      .values({
        contentHash: scene.cacheKey,
        segmentKey,
        durationMs: tts.durationMs,
        renderMs: Date.now() - renderStart,
      })
      .onConflictDoNothing();
    rendered += 1;
    segments.push({ key: segmentKey, durationMs: tts.durationMs });
  }

  // ---------- encoding: склейка сегментов ----------
  await ensureNotCancelled();
  await setStage('encoding', 0.92);

  const dir = await mkdtemp(path.join(tmpdir(), `render-${jobId.slice(0, 8)}-`));
  let outputBuffer: Buffer;
  let totalDurationMs: number;
  try {
    const files: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const file = path.join(dir, `seg-${i}.mp4`);
      await writeFile(file, await storage.read(seg.key));
      files.push(file);
    }
    const listFile = path.join(dir, 'list.txt');
    await writeFile(listFile, files.map((f) => `file '${f}'`).join('\n'));
    const outFile = path.join(dir, 'final.mp4');
    // Сегменты кодированы одинаково → склейка без перекодирования
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile]);
    outputBuffer = await readFile(outFile);
    totalDurationMs = await ffprobeDurationMs(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const outputKey = `renders/${jobId}.mp4`;
  await storage.write(outputKey, outputBuffer, 'video/mp4');

  const finalized = await finalizeRenderJob(db, jobId, 'done', {
    outputKey,
    durationMs: totalDurationMs,
    actualCost: creditCost(totalDurationMs, quality),
    meta: { scenes: total, cacheHits, rendered },
  });
  if (finalized) {
    await event('done', 'done', 1, `готово: сцен ${total}, из кэша ${cacheHits}, отрендерено ${rendered}`);
  }
}

interface CompositeArgs {
  width: number;
  height: number;
  durationMs: number;
  background: Record<string, unknown>;
  avatarVideo: Uint8Array;
  audioWav: Uint8Array;
  alignment: WordTiming[];
  textLayers: Array<Record<string, unknown>>;
}

/** FFmpeg-композитинг сцены: фон + аватар + текстовые слои + burn-in субтитры + аудио. */
async function compositeScene(args: CompositeArgs): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'composite-'));
  try {
    const avatarFile = path.join(dir, 'avatar.mp4');
    const audioFile = path.join(dir, 'audio.wav');
    const srtFile = path.join(dir, 'subs.srt');
    const outFile = path.join(dir, 'scene.mp4');
    await writeFile(avatarFile, args.avatarVideo);
    await writeFile(audioFile, args.audioWav);
    const srt = alignmentToSrt(args.alignment);
    await writeFile(srtFile, srt);

    const durSec = (args.durationMs / 1000).toFixed(3);
    const bgColor =
      typeof args.background.color === 'string'
        ? `0x${args.background.color.replace('#', '')}`
        : '0x1A1A2E';

    const filters: string[] = [
      `[0:v][1:v]overlay=x=main_w-overlay_w-32:y=main_h-overlay_h-32[v0]`,
    ];
    let current = 'v0';
    for (const [i, layer] of args.textLayers.entries()) {
      const text = escapeDrawtext(String(layer.text ?? ''));
      if (!text) continue;
      const x = typeof layer.x === 'number' ? `w*${layer.x}` : '48';
      const y = typeof layer.y === 'number' ? `h*${layer.y}` : `${64 + i * 48}`;
      const next = `v${i + 1}`;
      filters.push(
        `[${current}]drawtext=fontfile=${FONT_FILE}:text='${text}':fontcolor=white:fontsize=32:x=${x}:y=${y}[${next}]`,
      );
      current = next;
    }
    if (srt) {
      filters.push(
        `[${current}]subtitles='${srtFile}':force_style='FontName=DejaVu Sans,FontSize=18'[vout]`,
      );
    } else {
      filters.push(`[${current}]null[vout]`);
    }

    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `color=c=${bgColor}:s=${args.width}x${args.height}:d=${durSec}:r=25`,
      '-i', avatarFile,
      '-i', audioFile,
      '-filter_complex', filters.join(';'),
      '-map', '[vout]',
      '-map', '2:a',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-ar', '48000',
      '-t', durSec,
      outFile,
    ]);
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
