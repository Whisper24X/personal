import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillRepository } from '../skill.repository';
import { SkillEntity } from './entities/skill.entity';
import { SkillRelationalRepository } from './repositories/skill.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SkillEntity])],
  providers: [
    {
      provide: SkillRepository,
      useClass: SkillRelationalRepository,
    },
  ],
  exports: [SkillRepository],
})
export class RelationalSkillPersistenceModule {}
