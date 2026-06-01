import { Injectable } from '@nestjs/common';
import { DEFAULT_MEMORY_PLUGIN_ID } from './memory.types';
import type { MemoryInjectPlugin } from './memory.types';

@Injectable()
export class MemoryInjectRegistry {
  private readonly plugins = new Map<string, MemoryInjectPlugin>();

  register(plugin: MemoryInjectPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): MemoryInjectPlugin | null {
    return (
      this.plugins.get(id) ?? this.plugins.get(DEFAULT_MEMORY_PLUGIN_ID) ?? null
    );
  }
}
