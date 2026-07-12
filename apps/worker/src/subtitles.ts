import type { WordTiming } from '@avatarstudio/shared';

const MAX_WORDS_PER_CUE = 7;

/** Субтитры из alignment (FR-4.6): группировка слов в реплики ≤ 7 слов. */
export function alignmentToSrt(alignment: readonly WordTiming[]): string {
  if (!alignment.length) return '';
  const cues: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < alignment.length; i += MAX_WORDS_PER_CUE) {
    const chunk = alignment.slice(i, i + MAX_WORDS_PER_CUE);
    cues.push({
      start: chunk[0]!.startMs,
      end: chunk[chunk.length - 1]!.endMs,
      text: chunk.map((w) => w.word).join(' '),
    });
  }
  return cues
    .map((cue, i) => `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`)
    .join('\n');
}

export function srtTime(ms: number): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(Math.floor(ms % 1000), 3)}`;
}
