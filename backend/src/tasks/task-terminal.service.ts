import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  CreateTaskTerminalSessionDto,
  TaskTerminalEventDto,
  TaskTerminalInputDto,
  TaskTerminalSessionDto,
  TaskTerminalSessionStatus,
} from './dto/task-terminal.dto';
import { Task } from './domain/task';
import { TasksService } from './tasks.service';

type TerminalSessionInternal = {
  id: string;
  taskId: string;
  cwd: string;
  shell: string;
  status: TaskTerminalSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  process: ChildProcessWithoutNullStreams | null;
  listeners: Set<(event: TaskTerminalEventDto) => void>;
  history: TaskTerminalEventDto[];
};

@Injectable()
export class TaskTerminalService implements OnModuleDestroy {
  private readonly sessionsByTaskId = new Map<
    string,
    Map<string, TerminalSessionInternal>
  >();
  private readonly maxHistoryEvents = 1_000;

  constructor(private readonly tasksService: TasksService) {}

  onModuleDestroy(): void {
    for (const sessions of this.sessionsByTaskId.values()) {
      for (const session of sessions.values()) {
        this.stopSessionProcess(session);
      }
    }

    this.sessionsByTaskId.clear();
  }

  async createSession(
    taskId: string,
    payload: CreateTaskTerminalSessionDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskTerminalSessionDto> {
    const { workspacePath } = await this.resolveTaskWorkspace(
      taskId,
      currentUser,
    );

    const shell = this.resolveShell(payload.shell);
    const sessionId = randomUUID();
    const now = new Date();

    const childProcess = spawn(shell, [], {
      cwd: workspacePath,
      env: process.env,
      stdio: 'pipe',
    });

    const session: TerminalSessionInternal = {
      id: sessionId,
      taskId,
      cwd: workspacePath,
      shell,
      status: TaskTerminalSessionStatus.running,
      createdAt: now,
      updatedAt: now,
      process: childProcess,
      listeners: new Set(),
      history: [],
    };

    const taskSessions = this.getTaskSessions(taskId, true);
    taskSessions.set(sessionId, session);

    childProcess.stdout?.on('data', (chunk: Buffer | string) => {
      const data = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      this.emitEvent(session, {
        type: 'chunk',
        stream: 'stdout',
        data,
        timestamp: new Date(),
      });
    });

    childProcess.stderr?.on('data', (chunk: Buffer | string) => {
      const data = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      this.emitEvent(session, {
        type: 'chunk',
        stream: 'stderr',
        data,
        timestamp: new Date(),
      });
    });

    childProcess.on('error', (error) => {
      this.updateSessionStatus(session, TaskTerminalSessionStatus.error);
      this.emitEvent(session, {
        type: 'error',
        message: error.message,
        timestamp: new Date(),
      });
      this.emitEvent(session, {
        type: 'status',
        message: TaskTerminalSessionStatus.error,
        timestamp: new Date(),
      });
    });

    childProcess.on('close', (code, signal) => {
      const nextStatus =
        session.status === TaskTerminalSessionStatus.error
          ? TaskTerminalSessionStatus.error
          : TaskTerminalSessionStatus.stopped;

      session.process = null;
      this.updateSessionStatus(session, nextStatus);

      this.emitEvent(session, {
        type: 'exit',
        code,
        signal,
        timestamp: new Date(),
      });
      this.emitEvent(session, {
        type: 'status',
        message: nextStatus,
        timestamp: new Date(),
      });
    });

    this.emitEvent(session, {
      type: 'status',
      message: TaskTerminalSessionStatus.running,
      timestamp: new Date(),
    });

    return this.toSessionDto(session);
  }

  async listSessions(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskTerminalSessionDto[]> {
    await this.tasksService.assertCanAccessTask(taskId, currentUser);

    return Array.from(this.getTaskSessions(taskId).values()).map((session) => {
      return this.toSessionDto(session);
    });
  }

  async input(
    taskId: string,
    sessionId: string,
    payload: TaskTerminalInputDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const session = await this.getSessionOrThrow(
      taskId,
      sessionId,
      currentUser,
    );

    if (
      !session.process ||
      session.status !== TaskTerminalSessionStatus.running
    ) {
      throw new ConflictException('Terminal session is not running');
    }

    session.process.stdin.write(payload.input);
    session.updatedAt = new Date();
  }

  async stopSession(
    taskId: string,
    sessionId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const session = await this.getSessionOrThrow(
      taskId,
      sessionId,
      currentUser,
    );

    this.stopSessionProcess(session);
  }

  async openSessionStream({
    taskId,
    sessionId,
    currentUser,
  }: {
    taskId: string;
    sessionId: string;
    currentUser: JwtPayloadType;
  }): Promise<{
    history: TaskTerminalEventDto[];
    subscribe: (listener: (event: TaskTerminalEventDto) => void) => () => void;
  }> {
    const session = await this.getSessionOrThrow(
      taskId,
      sessionId,
      currentUser,
    );

    return {
      history: [...session.history],
      subscribe: (listener) => {
        session.listeners.add(listener);

        return () => {
          session.listeners.delete(listener);
        };
      },
    };
  }

  private getTaskSessions(
    taskId: string,
    create = false,
  ): Map<string, TerminalSessionInternal> {
    const existed = this.sessionsByTaskId.get(taskId);
    if (existed) {
      return existed;
    }

    if (!create) {
      return new Map<string, TerminalSessionInternal>();
    }

    const nextMap = new Map<string, TerminalSessionInternal>();
    this.sessionsByTaskId.set(taskId, nextMap);

    return nextMap;
  }

  private emitEvent(
    session: TerminalSessionInternal,
    event: TaskTerminalEventDto,
  ): void {
    session.updatedAt = event.timestamp;
    session.history.push(event);

    if (session.history.length > this.maxHistoryEvents) {
      session.history.splice(0, session.history.length - this.maxHistoryEvents);
    }

    for (const listener of session.listeners) {
      listener(event);
    }
  }

  private updateSessionStatus(
    session: TerminalSessionInternal,
    status: TaskTerminalSessionStatus,
  ): void {
    session.status = status;
    session.updatedAt = new Date();
  }

  private resolveShell(shell?: string): string {
    const candidate = shell?.trim();

    if (candidate) {
      return candidate;
    }

    const envShell = process.env.SHELL?.trim();
    if (envShell) {
      return envShell;
    }

    return '/bin/bash';
  }

  private async resolveTaskWorkspace(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; workspacePath: string }> {
    const task = await this.tasksService.assertCanAccessTask(
      taskId,
      currentUser,
    );

    if (!task.gitWorktree?.trim()) {
      throw new ConflictException('Task workspace is not initialized');
    }

    const workspacePath = await fs.realpath(task.gitWorktree).catch(() => {
      throw new NotFoundException('Task workspace does not exist');
    });

    return {
      task,
      workspacePath,
    };
  }

  private async getSessionOrThrow(
    taskId: string,
    sessionId: string,
    currentUser: JwtPayloadType,
  ): Promise<TerminalSessionInternal> {
    await this.tasksService.assertCanAccessTask(taskId, currentUser);

    const session = this.getTaskSessions(taskId).get(sessionId);

    if (!session) {
      throw new NotFoundException('Terminal session not found');
    }

    return session;
  }

  private stopSessionProcess(session: TerminalSessionInternal): void {
    if (!session.process) {
      return;
    }

    const childProcess = session.process;
    childProcess.kill('SIGTERM');

    const forceKillTimer = setTimeout(() => {
      if (!session.process) {
        return;
      }

      session.process.kill('SIGKILL');
    }, 3_000);

    forceKillTimer.unref();
  }

  private toSessionDto(
    session: TerminalSessionInternal,
  ): TaskTerminalSessionDto {
    return {
      id: session.id,
      taskId: session.taskId,
      cwd: session.cwd,
      shell: session.shell,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
