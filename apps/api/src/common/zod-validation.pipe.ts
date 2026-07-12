import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Валидация тела запроса zod-схемой; ошибки — человекочитаемые (правило 5). */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_INPUT',
          message: 'Проверьте заполнение полей и повторите запрос',
          details: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            problem: i.message,
          })),
        },
      });
    }
    return result.data;
  }
}
