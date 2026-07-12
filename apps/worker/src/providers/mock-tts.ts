import {
  estimateSpeechDurationMs,
  type ITTSProvider,
  type TTSRequest,
  type TTSResult,
  type WordTiming,
} from '@avatarstudio/shared';

const SAMPLE_RATE = 16_000;

/**
 * MockTTS (Этап 4): тишина нужной длительности + синтетический alignment,
 * равномерный по словам. Длительность — по той же формуле, что оценка
 * кредитов в api, поэтому у моков estimate == actual.
 */
export class MockTTSProvider implements ITTSProvider {
  readonly name = 'mock-tts';

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const durationMs = estimateSpeechDurationMs(request.plainText);
    const words = request.plainText.trim().split(/\s+/).filter(Boolean);
    const perWord = words.length ? durationMs / words.length : durationMs;
    const alignment: WordTiming[] = words.map((word, i) => ({
      word,
      startMs: Math.round(i * perWord),
      endMs: Math.round((i + 1) * perWord),
    }));
    return { audio: silenceWav(durationMs), mime: 'audio/wav', durationMs, alignment };
  }
}

/** WAV-заголовок + нули: PCM 16 бит, моно, 16 кГц. */
export function silenceWav(durationMs: number): Uint8Array {
  const samples = Math.round((durationMs / 1000) * SAMPLE_RATE);
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // размер fmt-чанка
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // моно
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // байт/сек
  buf.writeUInt16LE(2, 32); // выравнивание блока
  buf.writeUInt16LE(16, 34); // бит/сэмпл
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}
