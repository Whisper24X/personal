import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

type TaskEmailPayload = {
  to: string;
  userId: string;
  taskId: string;
  eventType: string;
  status: string;
  title: string;
  content: string;
  occurredAt: string;
};

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);
  private readonly smtpHost = process.env.AINATIVE_SMTP_HOST?.trim();
  private readonly smtpPort = Number(process.env.AINATIVE_SMTP_PORT ?? 25);
  private readonly smtpUser = process.env.AINATIVE_SMTP_USER?.trim();
  private readonly smtpPass = process.env.AINATIVE_SMTP_PASS;
  private readonly smtpFrom = process.env.AINATIVE_SMTP_FROM?.trim();
  private readonly smtpSecure = this.parseBoolean(
    process.env.AINATIVE_SMTP_SECURE,
  );
  private transporter: Transporter | null = null;
  private missingConfigWarned = false;

  async sendTaskStatusEmail(payload: TaskEmailPayload): Promise<void> {
    if (!this.smtpHost || !this.smtpFrom || Number.isNaN(this.smtpPort)) {
      this.warnMissingConfigOnce();
      return;
    }

    const transporter = this.getTransporter();
    const subject = `[AINative] ${payload.title}`;
    const text = [
      payload.content,
      '',
      `任务ID: ${payload.taskId}`,
      `状态: ${payload.status}`,
      `事件: ${payload.eventType}`,
      `用户ID: ${payload.userId}`,
      `时间: ${payload.occurredAt}`,
    ].join('\n');

    await transporter.sendMail({
      from: this.smtpFrom,
      to: payload.to,
      subject,
      text,
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: this.smtpUser
        ? {
            user: this.smtpUser,
            pass: this.smtpPass ?? '',
          }
        : undefined,
      connectionTimeout: 5_000,
    });

    return this.transporter;
  }

  private warnMissingConfigOnce(): void {
    if (this.missingConfigWarned) {
      return;
    }

    this.missingConfigWarned = true;
    this.logger.warn(
      'AINATIVE_SMTP_HOST/AINATIVE_SMTP_FROM not configured, skip email notifications',
    );
  }

  private parseBoolean(rawValue?: string): boolean {
    if (!rawValue) {
      return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(rawValue.toLowerCase());
  }
}
