/**
 * Контракты ML-провайдеров (ветка C из CLAUDE.md): бизнес-логика не знает,
 * какой провайдер под капотом. Этап 4 — mock-реализации в worker;
 * Этап 7 — адаптеры коммерческих API за этими же интерфейсами.
 */

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TTSRequest {
  /** SSML, скомпилированный из Director Markup. */
  ssml: string;
  /** Чистый текст (для провайдеров без SSML и для оценок). */
  plainText: string;
  language: string;
  voiceId: string | null;
}

export interface TTSResult {
  audio: Uint8Array;
  mime: 'audio/wav';
  durationMs: number;
  /** Обязателен (FR-3.9): от него зависят липсинк, субтитры, тайминг жестов. */
  alignment: WordTiming[];
}

export interface ITTSProvider {
  readonly name: string;
  synthesize(request: TTSRequest): Promise<TTSResult>;
}

export interface GestureCueInput {
  kind: 'gesture' | 'look' | 'breath';
  key: string;
  textOffset: number;
}

export interface AvatarDriveRequest {
  avatarId: string | null;
  audio: Uint8Array;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  gestureCues: GestureCueInput[];
}

export interface AvatarDriveResult {
  video: Uint8Array;
  mime: 'video/mp4';
}

export interface IAvatarDriver {
  readonly name: string;
  drive(request: AvatarDriveRequest): Promise<AvatarDriveResult>;
}
