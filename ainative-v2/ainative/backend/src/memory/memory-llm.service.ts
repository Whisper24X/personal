import { Injectable, Logger } from '@nestjs/common';
import * as childProcess from 'child_process';
import { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type AnthropicMessagesResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

@Injectable()
export class MemoryLlmService {
  private readonly logger = new Logger(MemoryLlmService.name);

  async completeJson<T>(args: {
    config: MemoryRuntimeConfigSnapshot;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }): Promise<T> {
    const raw = await this.completeRaw(args);
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '');
    return JSON.parse(cleaned) as T;
  }

  private async completeRaw(args: {
    config: MemoryRuntimeConfigSnapshot;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    if (args.config.llmProvider === 'anthropic') {
      return this.completeAnthropicRaw(args);
    }

    if (args.config.llmProvider === 'cursor-agent') {
      return this.completeCursorAgentRaw(args);
    }

    return this.completeOpenAiCompatibleRaw(args);
  }

  private async completeOpenAiCompatibleRaw(args: {
    config: MemoryRuntimeConfigSnapshot;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    const base = args.config.llmBaseUrl.trim();
    if (!base) {
      throw new Error(
        'No OpenAI-compatible base URL resolved for knowledge memory LLM — set MEMORY_LLM_BASE_URL, configure a supported default agent tool for the project business line, or set OPENAI_BASE_URL',
      );
    }
    const url = `${base.replace(/\/$/, '')}/chat/completions`;
    const maxRetries = Math.max(0, args.config.llmMaxRetries);
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(args.config.llmApiKey
              ? { Authorization: `Bearer ${args.config.llmApiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: args.config.llmModel,
            temperature: 0.2,
            max_tokens: args.maxOutputTokens ?? 4096,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: args.system },
              { role: 'user', content: args.user },
            ],
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 500)}`);
        }
        const json = (await res.json()) as ChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content?.trim()) {
          throw new Error('empty LLM content');
        }
        return content;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(
          `memory_llm_attempt_failed attempt=${attempt + 1} ${lastErr.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        }
      }
    }
    throw lastErr ?? new Error('LLM failed');
  }

  private async completeAnthropicRaw(args: {
    config: MemoryRuntimeConfigSnapshot;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    const base =
      args.config.llmBaseUrl.trim() || 'https://api.anthropic.com/v1';
    const url = `${base.replace(/\/$/, '')}/messages`;
    const maxRetries = Math.max(0, args.config.llmMaxRetries);
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            ...(args.config.llmApiKey
              ? { 'x-api-key': args.config.llmApiKey }
              : {}),
            ...this.parseHeaderLines(args.config.llmHeaders),
          },
          body: JSON.stringify({
            model: args.config.llmModel,
            system: args.system,
            max_tokens: args.maxOutputTokens ?? 4096,
            temperature: 0.2,
            messages: [
              {
                role: 'user',
                content: `${args.user}\n\nReturn only valid JSON.`,
              },
            ],
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(
            `Anthropic LLM HTTP ${res.status}: ${t.slice(0, 500)}`,
          );
        }
        const json = (await res.json()) as AnthropicMessagesResponse;
        const content = json.content
          ?.map((item) => (item.type === 'text' ? item.text : ''))
          .filter((text): text is string => Boolean(text?.trim()))
          .join('\n');
        if (!content?.trim()) {
          throw new Error('empty Anthropic LLM content');
        }
        return content;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        this.logger.warn(
          `memory_anthropic_attempt_failed attempt=${attempt + 1} ${lastErr.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        }
      }
    }

    throw lastErr ?? new Error('Anthropic LLM failed');
  }

  private async completeCursorAgentRaw(args: {
    config: MemoryRuntimeConfigSnapshot;
    system: string;
    user: string;
    maxOutputTokens?: number;
  }): Promise<string> {
    void args.maxOutputTokens;
    const command =
      args.config.llmCommand.trim() ||
      process.env.AINATIVE_CURSOR_RUNNER_COMMAND?.trim() ||
      'agent';
    const cliArgs = [
      '-p',
      '--mode',
      'ask',
      '--output-format',
      'json',
      '--sandbox',
      'enabled',
    ];

    if (args.config.llmModel.trim()) {
      cliArgs.push('--model', args.config.llmModel.trim());
    }

    for (const header of args.config.llmHeaders) {
      cliArgs.push('--header', header);
    }

    cliArgs.push(
      [
        args.system,
        '',
        args.user,
        '',
        'Return only valid JSON. Do not edit files or run commands.',
      ].join('\n'),
    );

    const stdout = await this.runCursorAgentCommand(command, cliArgs, {
      ...(args.config.llmApiKey
        ? { CURSOR_API_KEY: args.config.llmApiKey }
        : {}),
    });
    return this.extractCursorJsonText(stdout);
  }

  protected runCursorAgentCommand(
    command: string,
    args: string[],
    env: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      childProcess.execFile(
        command,
        args,
        {
          env: {
            ...process.env,
            ...env,
          },
          maxBuffer: 1024 * 1024 * 8,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `Cursor Agent LLM failed: ${error.message}; stderr=${stderr.slice(0, 500)}`,
              ),
            );
            return;
          }
          resolve(String(stdout));
        },
      );
    });
  }

  private extractCursorJsonText(stdout: string): string {
    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error('empty Cursor Agent LLM content');
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const text = this.findCursorResultText(parsed);
      if (text) {
        return text;
      }
    } catch {
      // Fall through to raw text; completeJson will parse or report a JSON error.
    }

    return trimmed;
  }

  private findCursorResultText(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findCursorResultText(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of ['result', 'text', 'content', 'message'] as const) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    for (const nested of Object.values(record)) {
      const found = this.findCursorResultText(nested);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private parseHeaderLines(lines: string[]): Record<string, string> {
    return lines.reduce<Record<string, string>>((headers, line) => {
      const index = line.indexOf(':');
      if (index <= 0) {
        return headers;
      }
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key && value) {
        headers[key] = value;
      }
      return headers;
    }, {});
  }
}
