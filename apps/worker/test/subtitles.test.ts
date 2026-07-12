import { describe, expect, it } from 'vitest';
import { alignmentToSrt, srtTime } from '../src/subtitles.js';
import { silenceWav } from '../src/providers/mock-tts.js';
import { MockTTSProvider } from '../src/providers/mock-tts.js';

describe('srtTime', () => {
  it('форматирует миллисекунды в таймкод SRT', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(1234)).toBe('00:00:01,234');
    expect(srtTime(3_661_500)).toBe('01:01:01,500');
  });
});

describe('alignmentToSrt', () => {
  it('группирует слова в реплики ≤ 7 слов', () => {
    const alignment = Array.from({ length: 10 }, (_, i) => ({
      word: `слово${i + 1}`,
      startMs: i * 300,
      endMs: (i + 1) * 300,
    }));
    const srt = alignmentToSrt(alignment);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,100\nслово1');
    expect(srt).toContain('2\n00:00:02,100 --> 00:00:03,000');
    expect(srt.trim().split('\n\n')).toHaveLength(2);
  });

  it('пустой alignment → пустая строка', () => {
    expect(alignmentToSrt([])).toBe('');
  });
});

describe('MockTTS', () => {
  it('длительность детерминирована, alignment покрывает все слова', async () => {
    const tts = new MockTTSProvider();
    const res = await tts.synthesize({
      ssml: '<speak>раз два три</speak>',
      plainText: 'раз два три',
      language: 'ru',
      voiceId: null,
    });
    expect(res.durationMs).toBe(1050);
    expect(res.alignment).toHaveLength(3);
    expect(res.alignment[2]!.endMs).toBe(1050);
  });

  it('WAV-заголовок корректен', () => {
    const wav = Buffer.from(silenceWav(1000));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.length).toBe(44 + 16000 * 2);
  });
});
