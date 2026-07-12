import { Injectable } from '@nestjs/common';

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Заглушка-логгер вместо SMTP (Этап 1, PLAN.md). Реальный провайдер письма
 * подключится позже за этим же интерфейсом. `sent` хранится в памяти,
 * чтобы тесты могли проверить содержимое писем.
 */
@Injectable()
export class MailerService {
  readonly sent: OutgoingMail[] = [];

  async send(mail: OutgoingMail): Promise<void> {
    this.sent.push(mail);
    console.log(`[mailer] → ${mail.to} | ${mail.subject}\n${mail.body}`);
  }
}
