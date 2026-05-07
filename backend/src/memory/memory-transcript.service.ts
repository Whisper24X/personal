import { Injectable } from '@nestjs/common';
import { TaskMessageRole } from '../tasks/dto/task-message.dto';
import { TaskNodeRepository } from '../tasks/infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { TaskLogRepository } from '../tasks/infrastructure/persistence/task-log.repository';
import { TaskOutputService } from '../tasks/application/task-output.service';
@Injectable()
export class MemoryTranscriptService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskOutputService: TaskOutputService,
    private readonly taskLogRepository: TaskLogRepository,
  ) {}

  async buildFullTaskTranscript(taskId: string): Promise<{
    text: string;
    bytes: number;
    nodesRead: number;
  }> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return { text: '', bytes: 0, nodesRead: 0 };
    }

    const nodes = await this.taskNodeRepository.findByTaskId(taskId);
    const ordered = [...nodes].sort(
      (a, b) => a.nodeOrder - b.nodeOrder || a.id.localeCompare(b.id),
    );

    const parts: string[] = [];

    const logs = await this.taskLogRepository.findByTaskIdSince({
      taskId,
      limit: 10_000,
    });
    for (const log of logs) {
      const p = this.stringifyLogForTranscript(log.message, log.payload);
      if (p) {
        parts.push(`[task_log][id=${log.id}] ${p}`);
      }
    }

    let nodesRead = 0;
    for (const node of ordered) {
      const { messages, metrics } =
        await this.taskOutputService.readNodeOutputMessagesWithMetrics(
          task,
          node,
        );
      if (metrics.messageCount > 0) {
        nodesRead += 1;
      }
      for (const m of messages) {
        if (!m.content?.trim()) {
          continue;
        }
        const role = m.role === TaskMessageRole.user ? 'user' : 'assistant';
        parts.push(
          `[node:${node.id}][${role}][t=${m.createdAt.toISOString()}] ${m.content.trim()}`,
        );
      }
    }

    const text = parts.join('\n\n');
    const bytes = Buffer.byteLength(text, 'utf8');
    return { text, bytes, nodesRead };
  }

  private stringifyLogForTranscript(
    message: string,
    payload: Record<string, unknown> | null | undefined,
  ): string | null {
    const m = message.trim();
    if (!m && !payload) {
      return null;
    }
    const p =
      payload && Object.keys(payload).length
        ? (() => {
            try {
              return JSON.stringify(payload).slice(0, 2000);
            } catch {
              return '';
            }
          })()
        : '';
    if (!m && !p) {
      return null;
    }
    return p ? `${m} ${p}`.trim() : m;
  }
}
