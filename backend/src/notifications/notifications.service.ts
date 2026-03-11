import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationSetting } from './domain/notification-setting';
import { NotificationSettingRepository } from './infrastructure/persistence/notification-setting.repository';
import { NotificationEventRepository } from './infrastructure/persistence/notification-event.repository';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { NotificationEvent } from './domain/notification-event';
import { FindNotificationEventsDto } from './dto/find-notification-events.dto';
import { NotificationEmailService } from './notification-email.service';

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
    private readonly notificationEmailService: NotificationEmailService,
  ) {}

  async getMySetting(userId: string): Promise<NotificationSetting> {
    const existedSetting =
      await this.notificationSettingRepository.findByUserId(userId);

    if (existedSetting) {
      return existedSetting;
    }

    return this.notificationSettingRepository.create({
      userId,
      emailEnabled: false,
      emailAddress: null,
      webhookEnabled: false,
      webhookUrl: null,
      browserEnabled: true,
    });
  }

  async updateMySetting(
    userId: string,
    updateDto: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    const existedSetting = await this.getMySetting(userId);
    const nextEmailEnabled =
      updateDto.emailEnabled ?? existedSetting.emailEnabled;
    const nextEmailAddress =
      updateDto.emailAddress !== undefined
        ? updateDto.emailAddress?.trim() || null
        : existedSetting.emailAddress?.trim() || null;
    const nextWebhookEnabled =
      updateDto.webhookEnabled ?? existedSetting.webhookEnabled;
    const nextWebhookUrl =
      updateDto.webhookUrl !== undefined
        ? updateDto.webhookUrl?.trim() || null
        : existedSetting.webhookUrl?.trim() || null;

    if (nextEmailEnabled && !nextEmailAddress) {
      throw new BadRequestException(
        'emailAddress is required when emailEnabled is true',
      );
    }

    if (nextWebhookEnabled && !nextWebhookUrl?.trim()) {
      throw new BadRequestException(
        'webhookUrl is required when webhookEnabled is true',
      );
    }

    const updatedSetting = await this.notificationSettingRepository.update(
      existedSetting.id,
      {
        ...(updateDto.emailEnabled !== undefined
          ? { emailEnabled: updateDto.emailEnabled }
          : {}),
        ...(updateDto.emailAddress !== undefined
          ? { emailAddress: nextEmailAddress }
          : {}),
        ...(updateDto.webhookEnabled !== undefined
          ? { webhookEnabled: updateDto.webhookEnabled }
          : {}),
        ...(updateDto.webhookUrl !== undefined
          ? { webhookUrl: nextWebhookUrl }
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
      });
    }

    const recipientEmail = setting.emailAddress?.trim() || null;
    if (setting.emailEnabled && recipientEmail) {
      void this.sendEmailNotification({
        recipientEmail,
        userId,
        taskId,
        eventType,
        status,
        title,
        content,
        occurredAt,
      });
    }

    if (!setting.browserEnabled) {
      return null;
    }

    return this.notificationEventRepository.create({
      userId,
      taskId,
      eventType,
      title,
      content,
      payload: {
        status,
      },
    });
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
  }: {
    userId: string;
    taskId: string;
    eventType: string;
    status: string;
    title: string;
    content: string;
    occurredAt: string;
    webhookUrl: string;
  }): Promise<void> {
    const dedupeKey = `${userId}:${taskId}:${eventType}`;
    const now = Date.now();

    this.pruneWebhookDedupCache(now);

    if (this.isWebhookSuppressed(dedupeKey, now)) {
      return;
    }

    this.webhookInFlight.add(dedupeKey);

    const payload = {
      eventType,
      taskId,
      status,
      title,
      content,
      occurredAt,
      userId,
    };

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

  private async sendEmailNotification({
    recipientEmail,
    userId,
    taskId,
    eventType,
    status,
    title,
    content,
    occurredAt,
  }: {
    recipientEmail: string;
    userId: string;
    taskId: string;
    eventType: string;
    status: string;
    title: string;
    content: string;
    occurredAt: string;
  }): Promise<void> {
    try {
      await this.notificationEmailService.sendTaskStatusEmail({
        to: recipientEmail,
        userId,
        taskId,
        eventType,
        status,
        title,
        content,
        occurredAt,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send task email notification: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
