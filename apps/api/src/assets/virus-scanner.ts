/** Контракт антивируса. Реальный сканер (ClamAV-класс) подключится за этим же интерфейсом. */
export interface VirusScanner {
  scan(key: string, sample: Buffer): Promise<{ clean: boolean; signature?: string }>;
}

export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

/** Заглушка Этапа 3: помечает всё чистым, логирует факт «сканирования». */
export class StubVirusScanner implements VirusScanner {
  async scan(key: string, sample: Buffer): Promise<{ clean: boolean }> {
    console.log(`[antivirus-stub] scanned ${key} (${sample.length} bytes): clean`);
    return { clean: true };
  }
}
