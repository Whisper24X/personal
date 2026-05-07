import { Injectable, OnModuleInit } from '@nestjs/common';
import { DefaultMemoryIngestPlugin } from './plugins/default-memory-ingest.plugin';
import { DefaultMemoryInjectPlugin } from './plugins/default-memory-inject.plugin';
import { MemoryIngestRegistry } from './memory-ingest.registry';
import { MemoryInjectRegistry } from './memory-inject.registry';

@Injectable()
export class MemoryPluginRegistrationService implements OnModuleInit {
  constructor(
    private readonly ingestRegistry: MemoryIngestRegistry,
    private readonly injectRegistry: MemoryInjectRegistry,
    private readonly defaultIngest: DefaultMemoryIngestPlugin,
    private readonly defaultInject: DefaultMemoryInjectPlugin,
  ) {}

  onModuleInit(): void {
    this.ingestRegistry.register(this.defaultIngest);
    this.injectRegistry.register(this.defaultInject);
  }
}
