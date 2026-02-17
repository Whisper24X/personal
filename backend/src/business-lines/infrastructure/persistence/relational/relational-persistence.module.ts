import { Module } from '@nestjs/common';
import { BusinessLineRepository } from '../business-line.repository';
import { BusinessLineRelationalRepository } from './repositories/business-line.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLineEntity } from './entities/business-line.entity';
import { BusinessLineMemberEntity } from './entities/business-line-member.entity';
import { BusinessLineMemberRepository } from '../business-line-member.repository';
import { BusinessLineMemberRelationalRepository } from './repositories/business-line-member.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessLineEntity, BusinessLineMemberEntity]),
  ],
  providers: [
    {
      provide: BusinessLineRepository,
      useClass: BusinessLineRelationalRepository,
    },
    {
      provide: BusinessLineMemberRepository,
      useClass: BusinessLineMemberRelationalRepository,
    },
  ],
  exports: [BusinessLineRepository, BusinessLineMemberRepository],
})
export class RelationalBusinessLinePersistenceModule {}
