import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpRepository } from '../mcp.repository';
import { McpEntity } from './entities/mcp.entity';
import { McpRelationalRepository } from './repositories/mcp.repository';

@Module({
  imports: [TypeOrmModule.forFeature([McpEntity])],
  providers: [
    {
      provide: McpRepository,
      useClass: McpRelationalRepository,
    },
  ],
  exports: [McpRepository],
})
export class RelationalMcpPersistenceModule {}
