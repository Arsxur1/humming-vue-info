import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FsObjectStorage, OBJECT_STORAGE, type ObjectStorage } from '@avatarstudio/storage';

/**
 * Приёмник «presigned» PUT для fs-драйвера. При S3-драйвере не используется:
 * presigned URL ведёт напрямую в MinIO/S3. Тело — raw (настроено в main.ts).
 */
@Controller('uploads')
export class UploadsController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  private requireFs(): FsObjectStorage {
    if (!(this.storage instanceof FsObjectStorage)) {
      throw new BadRequestException({
        error: {
          code: 'DIRECT_UPLOAD_ONLY',
          message: 'Файлы идут напрямую в S3 по presigned URL — этот эндпоинт не используется.',
        },
      });
    }
    return this.storage;
  }

  @Put(':token')
  async upload(@Param('token') token: string, @Req() req: Request) {
    const storage = this.requireFs();
    const payload = storage.verifyToken(token);
    if (!payload || payload.op !== 'put') {
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

  /** Скачивание по presigned GET-токену (fs-драйвер; в S3 — прямая ссылка в хранилище). */
  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const storage = this.requireFs();
    const payload = storage.verifyToken(token);
    if (!payload || payload.op !== 'get') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_DOWNLOAD_TOKEN',
          message: 'Ссылка скачивания недействительна или истекла. Запросите новую.',
        },
      });
    }
    const data = await this.storage.read(payload.key);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(data.length));
    res.end(data);
  }
}
