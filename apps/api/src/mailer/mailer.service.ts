import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '@avatarstudio/shared';
import { ENV } from '../common/env.provider.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Отправка почты (FR-1.1: верификация, приглашения, сброс пароля).
 * Реальный транспорт — SMTP через nodemailer, если задан SMTP_HOST; иначе
 * dev-режим: письмо пишется в лог (никуда не уходит). За единым методом
 * `send` — бизнес-логика не знает, какой транспорт под капотом.
 *
 * `sent` — последние письма в памяти (для тестов и отладки), с ограничением.
 */
@Injectable()
export class MailerService implements OnModuleDestroy {
  readonly sent: OutgoingMail[] = [];
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.from = env.SMTP_FROM;
    this.transport = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        })
      : null;
    if (!this.transport) {
      console.warn('[mailer] SMTP не настроен (SMTP_HOST пуст) — письма пишутся в лог, не отправляются');
    }
  }

  async send(mail: OutgoingMail): Promise<void> {
    this.remember(mail);
    if (this.transport) {
      await this.transport.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.body,
      });
    } else {
      console.log(`[mailer] → ${mail.to} | ${mail.subject}\n${mail.body}`);
    }
  }

  private remember(mail: OutgoingMail): void {
    this.sent.push(mail);
    if (this.sent.length > 200) this.sent.splice(0, this.sent.length - 200);
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
