import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as pty from 'node-pty';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  CreateTaskTerminalSessionDto,
  TaskTerminalEventDto,
  TaskTerminalInputDto,
  TaskTerminalSessionDto,
  TaskTerminalSessionStatus,
} from './dto/task-terminal.dto';
import { Task } from './domain/task';
import { TaskRuntimeService } from './task-runtime.service';
import { TasksService } from './tasks.service';

type TerminalSessionInternal = {
  id: string;
  taskId: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  status: TaskTerminalSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  ptyProcess: pty.IPty | null;
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

  constructor(
    private readonly tasksService: TasksService,
    private readonly taskRuntimeService: TaskRuntimeService,
  ) {}

  onModuleDestroy(): void {
    for (const sessions of this.sessionsByTaskId.values()) {
      for (const session of sessions.values()) {
        this.killPtyProcess(session);
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
    const cols = payload.cols ?? 80;
    const rows = payload.rows ?? 24;
    const sessionId = randomUUID();
    const now = new Date();

    const sanitizedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        sanitizedEnv[key] = value;
      }
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: workspacePath,
      env: sanitizedEnv,
    });

    const session: TerminalSessionInternal = {
      id: sessionId,
      taskId,
      cwd: workspacePath,
      shell,
      cols,
      rows,
      status: TaskTerminalSessionStatus.running,
      createdAt: now,
      updatedAt: now,
      ptyProcess,
      listeners: new Set(),
      history: [],
    };

    const taskSessions = this.getTaskSessions(taskId, true);
    taskSessions.set(sessionId, session);

    ptyProcess.onData((data: string) => {
      this.emitEvent(session, {
        type: 'chunk',
        stream: 'stdout',
        data,
        timestamp: new Date(),
      });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const nextStatus =
        session.status === TaskTerminalSessionStatus.error
          ? TaskTerminalSessionStatus.error
          : TaskTerminalSessionStatus.stopped;

      session.ptyProcess = null;
      this.updateSessionStatus(session, nextStatus);

      this.emitEvent(session, {
        type: 'exit',
        code: exitCode,
        signal: signal !== undefined ? String(signal) : null,
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

    this.writeToSession(session, payload.input);
  }

  writeToSessionDirect(taskId: string, sessionId: string, data: string): void {
    const session = this.getTaskSessions(taskId).get(sessionId);
    if (!session) {
      return;
    }

    this.writeToSession(session, data);
  }

  resizeSession(
    taskId: string,
    sessionId: string,
    cols: number,
    rows: number,
  ): void {
    const session = this.getTaskSessions(taskId).get(sessionId);
    if (
      !session?.ptyProcess ||
      session.status !== TaskTerminalSessionStatus.running
    ) {
      return;
    }

    session.ptyProcess.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
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

    this.killPtyProcess(session);
  }

  async removeSession(
    taskId: string,
    sessionId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const session = await this.getSessionOrThrow(
      taskId,
      sessionId,
      currentUser,
    );

    this.killPtyProcess(session);
    this.getTaskSessions(taskId).delete(sessionId);
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

  subscribeToSession(
    taskId: string,
    sessionId: string,
    listener: (event: TaskTerminalEventDto) => void,
  ): { history: TaskTerminalEventDto[]; unsubscribe: () => void } | null {
    const session = this.getTaskSessions(taskId).get(sessionId);
    if (!session) {
      return null;
    }

    session.listeners.add(listener);
    return {
      history: [...session.history],
      unsubscribe: () => {
        session.listeners.delete(listener);
      },
    };
  }

  async assertCanAccessTask(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    await this.tasksService.assertCanAccessTask(taskId, currentUser);
  }

  sessionExists(taskId: string, sessionId: string): boolean {
    return this.getTaskSessions(taskId).has(sessionId);
  }

  private writeToSession(
    session: TerminalSessionInternal,
    data: string,
  ): void {
    if (
      !session.ptyProcess ||
      session.status !== TaskTerminalSessionStatus.running
    ) {
      throw new ConflictException('Terminal session is not running');
    }

    session.ptyProcess.write(data);
    session.updatedAt = new Date();
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
    const { task, project } =
      await this.tasksService.assertCanAccessTaskProject(taskId, currentUser);

    if (!task.gitWorktree?.trim()) {
      throw new ConflictException('Task workspace is not initialized');
    }

    const runtimeWorkspacePath =
      this.taskRuntimeService.resolveTaskWorktreePath(task, project);

    const workspacePath = await fs.realpath(runtimeWorkspacePath).catch(() => {
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

  private killPtyProcess(session: TerminalSessionInternal): void {
    if (!session.ptyProcess) {
      return;
    }

    try {
      session.ptyProcess.kill();
    } catch {
      // PTY process may have already exited
    }
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
