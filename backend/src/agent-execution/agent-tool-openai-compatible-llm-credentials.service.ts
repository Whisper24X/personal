import { Injectable } from '@nestjs/common';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { Project } from '../projects/domain/project';
import { AgentCliAdapterId } from './agent-cli/agent-cli-adapter.interface';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { sanitizeAgentToolConfigJson } from './agent-cli-sanitize-config';

/** Matches Codex CLI base URL normalization for OpenAI-compatible chat/completions bases. */
export function normalizeCodexStyleOpenAiChatBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export type OpenAiCompatibleLlmTriple = {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
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
      if (triple.llmBaseUrl || triple.llmApiKey || triple.llmModel) {
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
    return {};
  }

  private extractFromCodexSanitized(
    sanitized: Record<string, unknown>,
  ): Partial<OpenAiCompatibleLlmTriple> {
    const out: Partial<OpenAiCompatibleLlmTriple> = {};
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
    const out: Partial<OpenAiCompatibleLlmTriple> = {};
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
}
