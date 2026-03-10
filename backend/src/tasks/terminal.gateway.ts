import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { AllConfigType } from '../config/config.type';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { TaskTerminalEventDto } from './dto/task-terminal.dto';
import { TaskTerminalService } from './task-terminal.service';

type ClientState = {
  user: JwtPayloadType;
  taskId: string | null;
  sessionId: string | null;
  unsubscribe: (() => void) | null;
};

@WebSocketGateway({ path: '/ws/terminal' })
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TerminalGateway.name);
  private readonly clients = new WeakMap<WebSocket, ClientState>();

  constructor(
    private readonly taskTerminalService: TaskTerminalService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  handleConnection(client: WebSocket, req: IncomingMessage) {
    try {
      const user = this.authenticateClient(req);
      this.clients.set(client, {
        user,
        taskId: null,
        sessionId: null,
        unsubscribe: null,
      });

      client.on('message', (raw: Buffer | string) => {
        this.handleMessage(client, raw);
      });
    } catch {
      this.sendToClient(client, { type: 'error', message: 'Unauthorized' });
      client.close(4401, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    if (state?.unsubscribe) {
      state.unsubscribe();
    }

    this.clients.delete(client);
  }

  private handleMessage(client: WebSocket, raw: Buffer | string) {
    const state = this.clients.get(client);
    if (!state) {
      return;
    }

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch {
      this.sendToClient(client, {
        type: 'error',
        message: 'Invalid JSON',
      });
      return;
    }

    const { type } = message;

    switch (type) {
      case 'attach':
        void this.handleAttach(client, state, message);
        break;
      case 'input':
        this.handleInput(state, message);
        break;
      case 'resize':
        this.handleResize(state, message);
        break;
      case 'detach':
        this.handleDetach(state);
        break;
      default:
        this.sendToClient(client, {
          type: 'error',
          message: `Unknown message type: ${String(type)}`,
        });
    }
  }

  private async handleAttach(
    client: WebSocket,
    state: ClientState,
    message: Record<string, unknown>,
  ) {
    const taskId = String(message.taskId ?? '');
    const sessionId = String(message.sessionId ?? '');

    if (!taskId || !sessionId) {
      this.sendToClient(client, {
        type: 'error',
        message: 'taskId and sessionId are required',
      });
      return;
    }

    try {
      await this.taskTerminalService.assertCanAccessTask(taskId, state.user);
    } catch {
      this.sendToClient(client, {
        type: 'error',
        message: 'Access denied or task not found',
      });
      return;
    }

    if (!this.taskTerminalService.sessionExists(taskId, sessionId)) {
      this.sendToClient(client, {
        type: 'error',
        message: 'Terminal session not found',
      });
      return;
    }

    if (state.unsubscribe) {
      state.unsubscribe();
    }

    const subscription = this.taskTerminalService.subscribeToSession(
      taskId,
      sessionId,
      (event: TaskTerminalEventDto) => {
        this.forwardEventToClient(client, event);
      },
    );

    if (!subscription) {
      this.sendToClient(client, {
        type: 'error',
        message: 'Failed to attach to session',
      });
      return;
    }

    state.taskId = taskId;
    state.sessionId = sessionId;
    state.unsubscribe = subscription.unsubscribe;

    this.sendToClient(client, { type: 'attached', sessionId });

    for (const historyEvent of subscription.history) {
      this.forwardEventToClient(client, historyEvent);
    }
  }

  private handleInput(state: ClientState, message: Record<string, unknown>) {
    if (!state.taskId || !state.sessionId) {
      return;
    }

    const data = message.data;
    if (typeof data !== 'string') {
      return;
    }

    try {
      this.taskTerminalService.writeToSessionDirect(
        state.taskId,
        state.sessionId,
        data,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to write to terminal session ${state.sessionId}: ${error}`,
      );
    }
  }

  private handleResize(state: ClientState, message: Record<string, unknown>) {
    if (!state.taskId || !state.sessionId) {
      return;
    }

    const cols = Number(message.cols);
    const rows = Number(message.rows);

    if (
      !Number.isFinite(cols) ||
      !Number.isFinite(rows) ||
      cols < 1 ||
      rows < 1
    ) {
      return;
    }

    this.taskTerminalService.resizeSession(
      state.taskId,
      state.sessionId,
      Math.min(cols, 500),
      Math.min(rows, 200),
    );
  }

  private handleDetach(state: ClientState) {
    if (state.unsubscribe) {
      state.unsubscribe();
    }

    state.taskId = null;
    state.sessionId = null;
    state.unsubscribe = null;
  }

  private forwardEventToClient(client: WebSocket, event: TaskTerminalEventDto) {
    if (event.type === 'chunk') {
      this.sendToClient(client, { type: 'output', data: event.data ?? '' });
    } else if (event.type === 'exit') {
      this.sendToClient(client, {
        type: 'exit',
        code: event.code ?? null,
        signal: event.signal ?? null,
      });
    } else if (event.type === 'error') {
      this.sendToClient(client, {
        type: 'error',
        message: event.message ?? 'Unknown error',
      });
    }
  }

  private sendToClient(client: WebSocket, payload: Record<string, unknown>) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }

  private authenticateClient(req: IncomingMessage): JwtPayloadType {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    );
    const token = url.searchParams.get('token');

    if (!token) {
      throw new Error('No token provided');
    }

    const secret = this.configService.getOrThrow('auth.secret', {
      infer: true,
    });

    const payload = this.jwtService.verify<JwtPayloadType>(token, { secret });

    if (!payload.sub) {
      throw new Error('Invalid token payload');
    }

    return payload;
  }
}
