import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly smtpHost: string | undefined;
  private readonly smtpPort: number;
  private readonly smtpUser: string | undefined;
  private readonly smtpPass: string | undefined;
  private readonly smtpFrom: string | undefined;
  private readonly smtpSecure: boolean;
  private transporter: Transporter | null = null;
  private missingConfigWarned = false;

  constructor(
    private readonly configService: ConfigService = new ConfigService(),
  ) {
    this.smtpHost = this.configService
      .get<string>('AINATIVE_SMTP_HOST', { infer: true })
      ?.trim();
    this.smtpPort = Number(
      this.configService.get<string>('AINATIVE_SMTP_PORT', { infer: true }) ??
        25,
    );
    this.smtpUser = this.configService
      .get<string>('AINATIVE_SMTP_USER', { infer: true })
      ?.trim();
    this.smtpPass = this.configService.get<string>('AINATIVE_SMTP_PASS', {
      infer: true,
    });
    this.smtpFrom = this.configService
      .get<string>('AINATIVE_SMTP_FROM', { infer: true })
      ?.trim();
    this.smtpSecure = this.parseBoolean(
      this.configService.get<string>('AINATIVE_SMTP_SECURE', { infer: true }),
    );
  }

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
