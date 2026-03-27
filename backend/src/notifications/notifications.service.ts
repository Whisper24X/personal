import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { AllConfigType } from '../config/config.type';
import { NotificationSetting } from './domain/notification-setting';
import { NotificationSettingRepository } from './infrastructure/persistence/notification-setting.repository';
import { NotificationEventRepository } from './infrastructure/persistence/notification-event.repository';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { NotificationEvent } from './domain/notification-event';
import { FindNotificationEventsDto } from './dto/find-notification-events.dto';
import { NotificationEventsEmitterService } from './notification-events-emitter.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webhookTimeoutMs = 5_000;
  private readonly webhookRetryDelaysMs = [500, 1_000, 2_000];
  private readonly webhookDedupWindowMs = 60_000;
  private readonly webhookLastSentAt = new Map<string, number>();
  private readonly webhookInFlight = new Set<string>();

  constructor(
    private readonly notificationSettingRepository: NotificationSettingRepository,
    private readonly notificationEventRepository: NotificationEventRepository,
    private readonly notificationEventsEmitter: NotificationEventsEmitterService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async getMySetting(userId: string): Promise<NotificationSetting> {
    const existedSetting =
      await this.notificationSettingRepository.findByUserId(userId);

    if (existedSetting) {
      return existedSetting;
    }

    return this.notificationSettingRepository.create({
      userId,
      webhookEnabled: false,
      webhookUrl: null,
      webhookSecret: null,
      browserEnabled: true,
    });
  }

  async updateMySetting(
    userId: string,
    updateDto: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    const existedSetting = await this.getMySetting(userId);
    const nextWebhookEnabled =
      updateDto.webhookEnabled ?? existedSetting.webhookEnabled;
    const nextWebhookUrl =
      updateDto.webhookUrl !== undefined
        ? updateDto.webhookUrl?.trim() || null
        : existedSetting.webhookUrl?.trim() || null;

    if (nextWebhookEnabled && !nextWebhookUrl?.trim()) {
      throw new BadRequestException(
        'webhookUrl is required when webhookEnabled is true',
      );
    }

    const updatedSetting = await this.notificationSettingRepository.update(
      existedSetting.id,
      {
        ...(updateDto.webhookEnabled !== undefined
          ? { webhookEnabled: updateDto.webhookEnabled }
          : {}),
        ...(updateDto.webhookUrl !== undefined
          ? { webhookUrl: nextWebhookUrl }
          : {}),
        ...(updateDto.webhookSecret !== undefined
          ? { webhookSecret: updateDto.webhookSecret?.trim() || null }
          : {}),
        ...(updateDto.browserEnabled !== undefined
          ? { browserEnabled: updateDto.browserEnabled }
          : {}),
      },
    );

    if (!updatedSetting) {
      throw new NotFoundException('Notification setting not found');
    }

    return updatedSetting;
  }

  async listMyEvents(
    userId: string,
    query: FindNotificationEventsDto,
  ): Promise<NotificationEvent[]> {
    return this.notificationEventRepository.findByUserId({
      userId,
      limit: query.limit ?? 20,
      unreadOnly: query.unreadOnly,
    });
  }

  async markEventRead(
    userId: string,
    eventId: string,
  ): Promise<NotificationEvent> {
    const event = await this.notificationEventRepository.findById(eventId);

    if (!event || event.userId !== userId) {
      throw new NotFoundException('Notification event not found');
    }

    const markedEvent = await this.notificationEventRepository.markRead(
      eventId,
      new Date(),
    );

    if (!markedEvent) {
      throw new NotFoundException('Notification event not found');
    }

    return markedEvent;
  }

  async markAllEventsRead(userId: string): Promise<{ affected: number }> {
    const affected = await this.notificationEventRepository.markAllReadByUserId(
      userId,
      new Date(),
    );

    return { affected };
  }

  async deleteReadEvents(userId: string): Promise<{ affected: number }> {
    const affected =
      await this.notificationEventRepository.deleteReadByUserId(userId);

    return { affected };
  }

  async countUnreadEvents(userId: string): Promise<{ count: number }> {
    const count =
      await this.notificationEventRepository.countUnreadByUserId(userId);

    return { count };
  }

  async notifyTaskStatusChanged({
    userId,
    taskId,
    taskTitle,
    status,
  }: {
    userId: string;
    taskId: string;
    taskTitle?: string;
    status: string;
  }): Promise<NotificationEvent | null> {
    if (status !== 'done' && status !== 'in_review') {
      return null;
    }

    const setting = await this.getMySetting(userId);

    const displayName = taskTitle || taskId;

    const title =
      status === 'done'
        ? '任务执行完成'
        : status === 'in_review'
          ? '任务需要处理'
          : '任务状态更新';

    const content =
      status === 'done'
        ? `任务「${displayName}」已执行完成。`
        : status === 'in_review'
          ? `任务「${displayName}」进入待处理状态，请审批或重试。`
          : `任务「${displayName}」状态更新为 ${status}。`;
    const eventType = `task.${status}`;
    const occurredAt = new Date().toISOString();

    if (setting.webhookEnabled && setting.webhookUrl?.trim()) {
      void this.sendWebhookNotification({
        userId,
        taskId,
        eventType,
        status,
        title,
        content,
        occurredAt,
        webhookUrl: setting.webhookUrl.trim(),
        webhookSecret: setting.webhookSecret?.trim() || null,
      });
    }

    if (!setting.browserEnabled) {
      return null;
    }

    const createdEvent = await this.notificationEventRepository.create({
      userId,
      taskId,
      eventType,
      title,
      content,
      payload: {
        status,
      },
    });

    this.notificationEventsEmitter.emit(userId, createdEvent);

    return createdEvent;
  }

  private async sendWebhookNotification({
    userId,
    taskId,
    eventType,
    status,
    title,
    content,
    occurredAt,
    webhookUrl,
    webhookSecret,
  }: {
    userId: string;
    taskId: string;
    eventType: string;
    status: string;
    title: string;
    content: string;
    occurredAt: string;
    webhookUrl: string;
    webhookSecret: string | null;
  }): Promise<void> {
    const dedupeKey = `${userId}:${taskId}:${eventType}`;
    const now = Date.now();

    this.pruneWebhookDedupCache(now);

    if (this.isWebhookSuppressed(dedupeKey, now)) {
      return;
    }

    this.webhookInFlight.add(dedupeKey);

    const payload = this.isFeishuUrl(webhookUrl)
      ? this.buildFeishuPayload({
          title,
          content,
          taskId,
          eventType,
          status,
          occurredAt,
          webhookSecret,
        })
      : { eventType, taskId, status, title, content, occurredAt, userId };

    try {
      let lastError: unknown = null;

      for (
        let attempt = 0;
        attempt <= this.webhookRetryDelaysMs.length;
        attempt += 1
      ) {
        try {
          const response = await this.sendWebhookRequest(webhookUrl, payload);
          if (!response.ok) {
            throw new Error(`Webhook responded with status ${response.status}`);
          }

          this.webhookLastSentAt.set(dedupeKey, now);
          return;
        } catch (error) {
          lastError = error;

          if (attempt >= this.webhookRetryDelaysMs.length) {
            break;
          }

          await this.delay(this.webhookRetryDelaysMs[attempt]);
        }
      }

      void lastError;
    } finally {
      this.webhookInFlight.delete(dedupeKey);
    }
  }

  private isWebhookSuppressed(dedupeKey: string, now: number): boolean {
    if (this.webhookInFlight.has(dedupeKey)) {
      return true;
    }

    const previousSentAt = this.webhookLastSentAt.get(dedupeKey);

    if (!previousSentAt) {
      return false;
    }

    return now - previousSentAt < this.webhookDedupWindowMs;
  }

  private pruneWebhookDedupCache(now: number): void {
    for (const [dedupeKey, sentAt] of this.webhookLastSentAt.entries()) {
      if (now - sentAt > this.webhookDedupWindowMs) {
        this.webhookLastSentAt.delete(dedupeKey);
      }
    }
  }

  private async sendWebhookRequest(
    webhookUrl: string,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.webhookTimeoutMs);

    try {
      return await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isFeishuUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return (
        hostname.endsWith('feishu.cn') || hostname.endsWith('larksuite.com')
      );
    } catch {
      return false;
    }
  }

  private buildFeishuPayload({
    title,
    content,
    taskId,
    eventType,
    status,
    occurredAt,
    webhookSecret,
  }: {
    title: string;
    content: string;
    taskId: string;
    eventType: string;
    status: string;
    occurredAt: string;
    webhookSecret: string | null;
  }): Record<string, unknown> {
    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const taskUrl = frontendDomain
      ? `${frontendDomain}/task-detail/${taskId}`
      : null;

    const statusLabel =
      status === 'done' ? '已完成' : status === 'in_review' ? '待处理' : status;

    const lines: Record<string, unknown>[][] = [
      [{ tag: 'text', text: content }],
      [],
      [
        { tag: 'text', text: '事件类型: ' },
        { tag: 'text', text: eventType },
      ],
      [
        { tag: 'text', text: '任务状态: ' },
        { tag: 'text', text: statusLabel },
      ],
      [
        { tag: 'text', text: '任务 ID: ' },
        { tag: 'text', text: taskId },
      ],
      [
        { tag: 'text', text: '发生时间: ' },
        { tag: 'text', text: occurredAt },
      ],
    ];

    if (taskUrl) {
      lines.push([]);
      lines.push([{ tag: 'a', text: '>> 查看任务详情', href: taskUrl }]);
    }

    const payload: Record<string, unknown> = {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title,
            content: lines,
          },
        },
      },
    };

    if (webhookSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      payload.timestamp = timestamp;
      payload.sign = this.signFeishu(webhookSecret, timestamp);
    }

    return payload;
  }

  private signFeishu(secret: string, timestamp: string): string {
    const stringToSign = `${timestamp}\n${secret}`;
    return createHmac('sha256', stringToSign).update('').digest('base64');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
