import { Injectable } from '@nestjs/common';
import { ClaudeCliAdapter } from './adapters/claude-cli.adapter';
import { CodexCliAdapter } from './adapters/codex-cli.adapter';
import { CursorCliAdapter } from './adapters/cursor-cli.adapter';
import { GeminiCliAdapter } from './adapters/gemini-cli.adapter';
import { OpencodeCliAdapter } from './adapters/opencode-cli.adapter';
import {
  AgentCliAdapter,
  AgentCliAdapterId,
} from './agent-cli-adapter.interface';

@Injectable()
export class AgentCliAdapterRegistry {
  private readonly adapters: AgentCliAdapter[] = [
    new CodexCliAdapter(),
    new CursorCliAdapter(),
    new ClaudeCliAdapter(),
    new GeminiCliAdapter(),
    new OpencodeCliAdapter(),
  ];

  private readonly adapterMap = new Map(
    this.adapters.map((adapter) => [adapter.id, adapter] as const),
  );

  getById(id: AgentCliAdapterId): AgentCliAdapter {
    return this.adapterMap.get(id) ?? this.adapterMap.get('codex')!;
  }

  resolve(value?: string | null): AgentCliAdapterId | null {
    if (!value?.trim()) {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    for (const adapter of this.adapters) {
      if (adapter.toolIdAliases.includes(normalized)) {
        return adapter.id;
      }
    }

    return null;
  }

  resolveToolIdCandidates(id: AgentCliAdapterId): string[] {
    return [...this.getById(id).toolIdAliases];
  }
}
