import { Injectable } from '@nestjs/common';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { Project } from '../projects/domain/project';
import { AgentCliAdapterId } from './agent-cli/agent-cli-adapter.interface';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { sanitizeAgentToolConfigJson } from './agent-cli-sanitize-config';
import type { MemoryLlmProvider } from '../memory/memory-runtime.config';

/** Matches Codex CLI base URL normalization for OpenAI-compatible chat/completions bases. */
export function normalizeCodexStyleOpenAiChatBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export type OpenAiCompatibleLlmTriple = {
  llmProvider: MemoryLlmProvider;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmHeaders: string[];
  llmCommand: string;
};

/**
 * Resolves OpenAI-compatible HTTP chat credentials from the same persisted
 * business-line default agent tool config as agent execution (Codex / OpenCode openai).
 */
@Injectable()
export class AgentToolOpenAiCompatibleLlmCredentialsService {
  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
  ) {}

  /**
   * Returns partial triple: only fields present in persisted default config.
   */
  async resolvePartialOpenAiCompatibleLlmFromPersistedDefaults(
    project: Project,
  ): Promise<Partial<OpenAiCompatibleLlmTriple>> {
    const adapter = this.resolveAdapterFromProjectConfig(project.configJson);
    const toolIdCandidates =
      this.agentCliAdapterRegistry.resolveToolIdCandidates(adapter);

    for (const toolId of toolIdCandidates) {
      const row =
        await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
          project.businessLineId,
          toolId,
        );
      if (!row) {
        continue;
      }
      const parsed = this.parsePersistedConfigJson(row.configJson);
      if (parsed === null) {
        continue;
      }
      const sanitized = sanitizeAgentToolConfigJson(
        this.agentCliAdapterRegistry,
        adapter,
        parsed,
      );
      const triple = this.extractOpenAiCompatibleTriple(adapter, sanitized);
      if (
        triple.llmBaseUrl ||
        triple.llmApiKey ||
        triple.llmModel ||
        triple.llmHeaders?.length
      ) {
        return triple;
      }
    }

    return {};
  }

  private resolveAdapterFromProjectConfig(
    configJson: Record<string, unknown> | null | undefined,
  ): AgentCliAdapterId {
    const projectConfigJson =
      configJson && typeof configJson === 'object' && !Array.isArray(configJson)
        ? configJson
        : {};
    for (const key of ['agentAdapter', 'toolId', 'agentCliId'] as const) {
      const raw = projectConfigJson[key];
      if (typeof raw === 'string') {
        const normalized = this.agentCliAdapterRegistry.resolve(raw);
        if (normalized) {
          return normalized;
        }
      }
    }
    return 'codex';
  }

  private parsePersistedConfigJson(
    configJson: string,
  ): Record<string, unknown> | null {
    if (!configJson.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(configJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }

  private extractOpenAiCompatibleTriple(
    adapter: AgentCliAdapterId,
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    if (adapter === 'codex') {
      return this.extractFromCodexSanitized(sanitized);
    }
    if (adapter === 'opencode') {
      return this.extractFromOpencodeSanitized(sanitized);
    }
    if (adapter === 'claude') {
      return this.extractFromClaudeSanitized(sanitized);
    }
    if (adapter === 'cursor') {
      return this.extractFromCursorSanitized(sanitized);
    }
    return {};
  }

  private extractFromCodexSanitized(
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    const out: Partial<OpenAiCompatibleLlmTriple> = {
      llmProvider: 'openai-compatible',
    };
    const baseRaw =
      typeof sanitized.base_url === 'string' && sanitized.base_url.trim()
        ? sanitized.base_url.trim()
        : '';
    if (baseRaw) {
      out.llmBaseUrl = normalizeCodexStyleOpenAiChatBaseUrl(baseRaw);
    }
    if (typeof sanitized.api_key === 'string' && sanitized.api_key.trim()) {
      out.llmApiKey = sanitized.api_key.trim();
    }
    if (typeof sanitized.model === 'string' && sanitized.model.trim()) {
      out.llmModel = sanitized.model.trim();
    }
    return out;
  }

  private extractFromOpencodeSanitized(
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    const provider =
      typeof sanitized.provider === 'string' && sanitized.provider.trim()
        ? sanitized.provider.trim().toLowerCase()
        : 'openai';
    if (provider !== 'openai') {
      return {};
    }
    const out: Partial<OpenAiCompatibleLlmTriple> = {
      llmProvider: 'openai-compatible',
    };
    const baseRaw =
      typeof sanitized.base_url === 'string' && sanitized.base_url.trim()
        ? sanitized.base_url.trim()
        : '';
    if (baseRaw) {
      out.llmBaseUrl = normalizeCodexStyleOpenAiChatBaseUrl(baseRaw);
    }
    if (typeof sanitized.api_key === 'string' && sanitized.api_key.trim()) {
      out.llmApiKey = sanitized.api_key.trim();
    }
    if (typeof sanitized.model === 'string' && sanitized.model.trim()) {
      out.llmModel = sanitized.model.trim();
    }
    return out;
  }

  private extractFromClaudeSanitized(
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    const env = this.extractStringEnv(sanitized.env);
    const authType =
      typeof sanitized.auth_type === 'string' && sanitized.auth_type.trim()
        ? sanitized.auth_type.trim()
        : 'ANTHROPIC_AUTH_TOKEN';
    const authToken =
      typeof sanitized.auth_token === 'string' && sanitized.auth_token.trim()
        ? sanitized.auth_token.trim()
        : '';
    const envToken =
      authType === 'ANTHROPIC_API_KEY'
        ? env.ANTHROPIC_API_KEY
        : env.ANTHROPIC_AUTH_TOKEN;
    const fallbackToken =
      env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || '';
    const token = authToken || envToken || fallbackToken;
    const baseRaw =
      typeof sanitized.base_url === 'string' && sanitized.base_url.trim()
        ? sanitized.base_url.trim()
        : (env.ANTHROPIC_BASE_URL ?? '');
    const model =
      typeof sanitized.model === 'string' && sanitized.model.trim()
        ? sanitized.model.trim()
        : '';

    if (!authToken && !envToken && !fallbackToken && !model && !baseRaw) {
      return {};
    }

    return {
      llmProvider: 'anthropic',
      llmApiKey: authType === 'ANTHROPIC_AUTH_TOKEN' ? '' : token,
      llmBaseUrl: baseRaw || 'https://api.anthropic.com/v1',
      llmModel: model,
      llmHeaders:
        authType === 'ANTHROPIC_AUTH_TOKEN' && token
          ? [`Authorization: Bearer ${token}`]
          : [],
    };
  }

  private extractFromCursorSanitized(
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    const env = this.extractStringEnv(sanitized.env);
    const apiKey =
      typeof sanitized.api_key === 'string' && sanitized.api_key.trim()
        ? sanitized.api_key.trim()
        : (env.CURSOR_API_KEY ?? '');
    const model =
      typeof sanitized.model === 'string' && sanitized.model.trim()
        ? sanitized.model.trim()
        : '';
    const headers = Array.isArray(sanitized.headers)
      ? sanitized.headers
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!apiKey && !model && !headers.length) {
      return {};
    }

    return {
      llmProvider: 'cursor-agent',
      llmApiKey: apiKey,
      llmModel: model,
      llmHeaders: headers,
    };
  }

  private extractStringEnv(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, string>
    >((result, [key, item]) => {
      if (typeof item === 'string' && item.trim()) {
        result[key] = item.trim();
      }
      return result;
    }, {});
  }
}
