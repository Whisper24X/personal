import { Module } from '@nestjs/common';
import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';
import { RelationalMcpPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalMcpPersistenceModule],
  controllers: [McpsController],
  providers: [McpsService],
  exports: [McpsService, RelationalMcpPersistenceModule],
})
export class McpsModule {}
