import { Injectable, Logger } from '@nestjs/common';
import { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
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
    const base = args.config.llmBaseUrl.trim();
    if (!base) {
      throw new Error(
        'No OpenAI-compatible base URL resolved for knowledge memory LLM — set MEMORY_LLM_BASE_URL, configure the default Codex-compatible agent tool for the project business line, or set OPENAI_BASE_URL',
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
}
