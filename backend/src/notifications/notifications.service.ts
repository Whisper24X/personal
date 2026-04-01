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
    if (status !== 'in_review') {
      return null;
    }

    const displayName = taskTitle || taskId;
    return this.publishNotification({
      userId,
      taskId,
      eventType: `task.${status}`,
      status,
      statusLabel: '待完成',
      title: '任务待完成',
      content: `任务「${displayName}」已进入待完成状态，请确认后完成任务。`,
      payload: {
        status,
      },
      webhookPayload: {
        status,
      },
      dedupeKey: `${userId}:${taskId}:task.${status}`,
    });
  }

  async notifyTaskNodeStatusChanged({
    userId,
    taskId,
    taskTitle,
    nodeId,
    nodeName,
    nodeOrder,
    status,
  }: {
    userId: string;
    taskId: string;
    taskTitle?: string;
    nodeId: string;
    nodeName?: string | null;
    nodeOrder?: number | null;
    status: string;
  }): Promise<NotificationEvent | null> {
    if (status !== 'in_review') {
      return null;
    }

    const displayTaskName = taskTitle || taskId;
    const normalizedNodeName = nodeName?.trim() || null;
    const nodeLabel = normalizedNodeName
      ? `节点「${normalizedNodeName}」`
      : typeof nodeOrder === 'number'
        ? `节点 #${nodeOrder}`
        : `节点 ${nodeId}`;

    return this.publishNotification({
      userId,
      taskId,
      eventType: `task_node.${status}`,
      status,
      statusLabel: '待审核',
      title: '任务节点待审核',
      content: `任务「${displayTaskName}」的${nodeLabel}已进入待审核状态，请确认后继续。`,
      payload: {
        status,
        nodeId,
        nodeName: normalizedNodeName,
        nodeOrder: nodeOrder ?? null,
      },
      webhookPayload: {
        status,
        nodeId,
        nodeName: normalizedNodeName,
        nodeOrder: nodeOrder ?? null,
      },
      dedupeKey: `${userId}:${taskId}:${nodeId}:task_node.${status}`,
    });
  }

  private async sendWebhookNotification({
    dedupeKey,
    userId,
    taskId,
    eventType,
    status,
    statusLabel,
    title,
    content,
    occurredAt,
    webhookUrl,
    webhookSecret,
    payload,
  }: {
    dedupeKey: string;
    userId: string;
    taskId: string;
    eventType: string;
    status: string;
    statusLabel: string;
    title: string;
    content: string;
    occurredAt: string;
    webhookUrl: string;
    webhookSecret: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const now = Date.now();

    this.pruneWebhookDedupCache(now);

    if (this.isWebhookSuppressed(dedupeKey, now)) {
      return;
    }

    this.webhookInFlight.add(dedupeKey);

    const webhookPayload = this.isFeishuUrl(webhookUrl)
      ? this.buildFeishuPayload({
          title,
          content,
          taskId,
          eventType,
          statusLabel,
          occurredAt,
          webhookSecret,
        })
      : {
          eventType,
          taskId,
          status,
          title,
          content,
          occurredAt,
          userId,
          ...payload,
        };

    try {
      let lastError: unknown = null;

      for (
        let attempt = 0;
        attempt <= this.webhookRetryDelaysMs.length;
        attempt += 1
      ) {
        try {
          const response = await this.sendWebhookRequest(
            webhookUrl,
            webhookPayload,
          );
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
    statusLabel,
    occurredAt,
    webhookSecret,
  }: {
    title: string;
    content: string;
    taskId: string;
    eventType: string;
    statusLabel: string;
    occurredAt: string;
    webhookSecret: string | null;
  }): Record<string, unknown> {
    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const taskUrl = frontendDomain
      ? `${frontendDomain}/task-detail/${taskId}`
      : null;

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

  private async publishNotification({
    userId,
    taskId,
    eventType,
    status,
    statusLabel,
    title,
    content,
    payload,
    webhookPayload,
    dedupeKey,
  }: {
    userId: string;
    taskId: string;
    eventType: string;
    status: string;
    statusLabel: string;
    title: string;
    content: string;
    payload: Record<string, unknown>;
    webhookPayload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<NotificationEvent | null> {
    const setting = await this.getMySetting(userId);
    const occurredAt = new Date().toISOString();

    if (setting.webhookEnabled && setting.webhookUrl?.trim()) {
      void this.sendWebhookNotification({
        dedupeKey,
        userId,
        taskId,
        eventType,
        status,
        statusLabel,
        title,
        content,
        occurredAt,
        webhookUrl: setting.webhookUrl.trim(),
        webhookSecret: setting.webhookSecret?.trim() || null,
        payload: webhookPayload,
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
      payload,
    });

    this.notificationEventsEmitter.emit(userId, createdEvent);

    return createdEvent;
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
