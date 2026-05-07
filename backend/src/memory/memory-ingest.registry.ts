import { Injectable } from '@nestjs/common';
import { DEFAULT_MEMORY_PLUGIN_ID } from './memory.types';
import type { MemoryIngestPlugin } from './memory.types';

@Injectable()
export class MemoryIngestRegistry {
  private readonly plugins = new Map<string, MemoryIngestPlugin>();

  register(plugin: MemoryIngestPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): MemoryIngestPlugin | null {
    return (
      this.plugins.get(id) ?? this.plugins.get(DEFAULT_MEMORY_PLUGIN_ID) ?? null
    );
  }
}
