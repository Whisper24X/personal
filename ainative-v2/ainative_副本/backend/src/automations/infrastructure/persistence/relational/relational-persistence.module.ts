import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRepository } from '../automation.repository';
import { AutomationEntity } from './entities/automation.entity';
import { AutomationRelationalRepository } from './repositories/automation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AutomationEntity])],
  providers: [
    {
      provide: AutomationRepository,
      useClass: AutomationRelationalRepository,
    },
  ],
  exports: [AutomationRepository],
})
export class RelationalAutomationPersistenceModule {}
