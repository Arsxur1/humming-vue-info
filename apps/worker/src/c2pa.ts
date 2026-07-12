import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  createC2pa,
  ManifestBuilder,
  SigningAlgorithm,
  type C2pa,
  type Signer,
} from 'c2pa-node';
import type { Env } from '@avatarstudio/shared';

/**
 * C2PA-манифест (FR-11.3, правило 1 CLAUDE.md): обязательный шаг encoding.
 * Любой рендер без манифеста — баг; сбой подписи валит джоб.
 *
 * Сертификат — из env; без него dev/test используют тестовые сертификаты
 * c2pa-node (подпись валидна структурно, но цепочка доверия тестовая).
 */
export interface GenerationInfo {
  jobId: string;
  workspaceId: string;
  projectTitle: string;
  scenes: number;
  scriptHash: string;
  providers: { tts: string; avatar: string };
}

export class C2paSigner {
  private c2pa: C2pa | null = null;

  constructor(
    private readonly env: Env,
    /** TSA обязателен для подписи; в dev — встроенный dev-tsa. */
    private readonly tsaUrl: string,
  ) {}

  private async instance(): Promise<C2pa> {
    if (this.c2pa) return this.c2pa;
    let certPath = this.env.C2PA_CERT_PATH;
    let keyPath = this.env.C2PA_KEY_PATH;
    if (!certPath || !keyPath) {
      // Тестовые сертификаты из пакета c2pa-node — только dev/test
      const require = createRequire(import.meta.url);
      const pkgRoot = path.dirname(require.resolve('c2pa-node/package.json'));
      certPath = path.join(pkgRoot, 'tests/fixtures/certs/es256.pub');
      keyPath = path.join(pkgRoot, 'tests/fixtures/certs/es256.pem');
      console.warn('[c2pa] используются ТЕСТОВЫЕ сертификаты — задайте C2PA_CERT_PATH/C2PA_KEY_PATH в production');
    }
    const signer: Signer = {
      type: 'local',
      certificate: await readFile(certPath),
      privateKey: await readFile(keyPath),
      algorithm: SigningAlgorithm.ES256,
      tsaUrl: this.tsaUrl,
    };
    this.c2pa = createC2pa({ signer });
    return this.c2pa;
  }

  /** Подписывает MP4 на месте (in → out); бросает при любом сбое. */
  async signVideo(inputPath: string, outputPath: string, info: GenerationInfo): Promise<void> {
    const c2pa = await this.instance();
    const manifest = new ManifestBuilder({
      claim_generator: 'AvatarStudio/0.0.1',
      format: 'video/mp4',
      title: info.projectTitle,
      assertions: [
        {
          label: 'com.avatarstudio.generation',
          data: {
            jobId: info.jobId,
            workspaceId: info.workspaceId,
            scenes: info.scenes,
            scriptHash: info.scriptHash,
            providers: info.providers,
            generatedAt: new Date().toISOString(),
          },
        },
        {
          // Маркировка синтетики (EU AI Act): контент сгенерирован ИИ
          label: 'c2pa.actions',
          data: {
            actions: [{ action: 'c2pa.created', digitalSourceType:
              'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' }],
          },
        },
      ],
    });
    await c2pa.sign({
      asset: { path: inputPath, mimeType: 'video/mp4' },
      manifest,
      options: { outputPath },
      thumbnail: false,
    });
  }
}
