import { Response } from 'express';
import { logger } from '../utils/logger';

export type CliLogPayload = {
  type: string;
  message: string;
  ts: string;
};

export type CliStreamEvent = {
  type?: string;
  message?: { content?: Array<{ text?: string }> };
  tool_call?: { writeToolCall?: { args: { path: string } }; readToolCall?: { args: { path: string } } };
  subtype?: string;
  model?: string;
};

class CliLogStreamService {
  private streams: Map<string, Set<Response>> = new Map();
  private buffers: Map<string, CliLogPayload[]> = new Map();
  private bufferSize = 200;

  private getStreamKey(projectId: string, versionId: string): string {
    return `${projectId}:${versionId}`;
  }

  addStream(projectId: string, versionId: string, res: Response, aliasKeys?: string[]): void {
    const key = this.getStreamKey(projectId, versionId);
    if (!this.streams.has(key)) {
      this.streams.set(key, new Set());
    }
    this.streams.get(key)!.add(res);
    if (aliasKeys?.length) {
      aliasKeys.forEach((aliasKey) => {
        if (!this.streams.has(aliasKey)) {
          this.streams.set(aliasKey, new Set());
        }
        this.streams.get(aliasKey)!.add(res);
      });
    }
    logger.debug('CliLogStreamService: addStream', {
      key,
      streams: this.streams.get(key)?.size || 0,
      aliasKeysCount: aliasKeys?.length || 0,
    });
    this.replay(projectId, versionId, res);
    if (aliasKeys?.length) {
      aliasKeys.forEach((aliasKey) => {
        this.replayByKey(aliasKey, res);
      });
    }
  }

  removeStream(projectId: string, versionId: string, res: Response): void {
    const key = this.getStreamKey(projectId, versionId);
    const set = this.streams.get(key);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        this.streams.delete(key);
      }
    }
    // Also remove from any alias keys
    this.streams.forEach((value, mapKey) => {
      if (mapKey === key) return;
      if (value.has(res)) {
        value.delete(res);
        if (value.size === 0) {
          this.streams.delete(mapKey);
        }
      }
    });
  }

  push(projectId: string, versionId: string, payload: CliLogPayload): void {
    const key = this.getStreamKey(projectId, versionId);
    const buffer = this.buffers.get(key) || [];
    buffer.push(payload);
    if (buffer.length > this.bufferSize) {
      buffer.splice(0, buffer.length - this.bufferSize);
    }
    this.buffers.set(key, buffer);

    // If streams exist, broadcast via SSE
    if (this.streams.size > 0) {
      const targetStreams = new Set<Response>();
      const versionSuffix = `:${versionId}`;
      this.streams.forEach((streamSet, streamKey) => {
        if (streamKey.endsWith(versionSuffix) && streamSet.size > 0) {
          streamSet.forEach((res) => targetStreams.add(res));
        }
      });
      if (targetStreams.size > 0) {
        const data = `data: ${JSON.stringify(payload)}\n\n`;
        targetStreams.forEach((res) => {
          res.write(data);
        });
      }
    }
  }

  replay(projectId: string, versionId: string, res: Response): void {
    const key = this.getStreamKey(projectId, versionId);
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.length === 0) return;
    logger.debug('CliLogStreamService: replay', { key, count: buffer.length });
    buffer.forEach((payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
  }

  private replayByKey(key: string, res: Response): void {
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.length === 0) return;
    logger.debug('CliLogStreamService: replay alias', { key, count: buffer.length });
    buffer.forEach((payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
  }

  formatStreamEvent(event: CliStreamEvent): string | null {
    if (event.type === 'assistant' && event.message?.content) {
      return event.message.content.map((c) => c.text || '').join('');
    }
    if (event.type === 'tool_call' && event.subtype === 'started') {
      if (event.tool_call?.writeToolCall) {
        return `🔧 写入: ${event.tool_call.writeToolCall.args.path}`;
      }
      if (event.tool_call?.readToolCall) {
        return `📖 读取: ${event.tool_call.readToolCall.args.path}`;
      }
    }
    if (event.type === 'tool_call' && event.subtype === 'completed') {
      return '✅ 工具调用完成';
    }
    if (event.type === 'system' && event.subtype === 'init' && event.model) {
      return `🤖 模型: ${event.model}`;
    }
    if (event.type === 'result') {
      return '✅ 执行完成';
    }
    return null;
  }

  getLogs(_projectId: string, versionId: string, afterTs?: string): CliLogPayload[] {
    // Collect all logs from buffers that match the versionId
    // This includes both main key (projectId:versionId) and alias keys (e.g., applicationId:versionId)
    const allLogs: CliLogPayload[] = [];
    const versionSuffix = `:${versionId}`;

    this.buffers.forEach((buffer, bufferKey) => {
      if (bufferKey.endsWith(versionSuffix)) {
        allLogs.push(...buffer);
      }
    });

    // Sort by timestamp to ensure chronological order
    allLogs.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    // Filter by afterTs if provided
    if (afterTs) {
      const afterTime = new Date(afterTs).getTime();
      return allLogs.filter((log) => new Date(log.ts).getTime() > afterTime);
    }

    return allLogs;
  }
}

export const cliLogStreamService = new CliLogStreamService();
