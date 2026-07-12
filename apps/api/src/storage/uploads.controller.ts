import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FsObjectStorage } from './fs-storage.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';

/**
 * Приёмник «presigned» PUT для fs-драйвера. При S3-драйвере не используется:
 * presigned URL ведёт напрямую в MinIO/S3. Тело — raw (настроено в main.ts).
 */
@Controller('uploads')
export class UploadsController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  @Put(':token')
  async upload(@Param('token') token: string, @Req() req: Request) {
    if (!(this.storage instanceof FsObjectStorage)) {
      throw new BadRequestException({
        error: {
          code: 'DIRECT_UPLOAD_ONLY',
          message: 'Загрузка идёт напрямую в S3 по presigned URL — этот эндпоинт не используется.',
        },
      });
    }
    const payload = this.storage.verifyToken(token);
    if (!payload) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_UPLOAD_TOKEN',
          message: 'Ссылка загрузки недействительна или истекла. Запросите новую.',
        },
      });
    }
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException({
        error: { code: 'EMPTY_BODY', message: 'Пустое тело запроса — файл не получен.' },
      });
    }
    await this.storage.write(payload.key, body, payload.mime);
    return { uploaded: true, key: payload.key, sizeBytes: body.length };
  }
}
