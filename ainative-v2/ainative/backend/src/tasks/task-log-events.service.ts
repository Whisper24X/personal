import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { TaskLog } from './domain/task-log';

@Injectable()
export class TaskLogEventsService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(log: TaskLog): void {
    this.emitter.emit(this.getTopic(log.taskId), log);
  }

  subscribe(taskId: string, listener: (log: TaskLog) => void): () => void {
    const topic = this.getTopic(taskId);
    this.emitter.on(topic, listener);

    return () => {
      this.emitter.off(topic, listener);
    };
  }

  private getTopic(taskId: string): string {
    return `task-log:${taskId}`;
  }
}
