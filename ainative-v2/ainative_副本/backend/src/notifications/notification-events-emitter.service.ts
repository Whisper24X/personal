import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NotificationEvent } from './domain/notification-event';

@Injectable()
export class NotificationEventsEmitterService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(userId: string, event: NotificationEvent): void {
    this.emitter.emit(this.getTopic(userId), event);
  }

  subscribe(
    userId: string,
    listener: (event: NotificationEvent) => void,
  ): () => void {
    const topic = this.getTopic(userId);
    this.emitter.on(topic, listener);

    return () => {
      this.emitter.off(topic, listener);
    };
  }

  private getTopic(userId: string): string {
    return `notification:${userId}`;
  }
}
