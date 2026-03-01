import { Module } from '@nestjs/common';
import { BusinessLineRepository } from '../business-line.repository';
import { BusinessLineRelationalRepository } from './repositories/business-line.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLineEntity } from './entities/business-line.entity';
import { BusinessLineMemberEntity } from './entities/business-line-member.entity';
import { BusinessLineMemberRepository } from '../business-line-member.repository';
import { BusinessLineMemberRelationalRepository } from './repositories/business-line-member.repository';
import { BusinessLineInvitationEntity } from './entities/business-line-invitation.entity';
import { BusinessLineInvitationRepository } from '../business-line-invitation.repository';
import { BusinessLineInvitationRelationalRepository } from './repositories/business-line-invitation.repository';
import { AgentToolConfigRepository } from '../agent-tool-config.repository';
import { AgentToolConfigRelationalRepository } from './repositories/agent-tool-config.repository';
import { AgentToolConfigEntity } from './entities/agent-tool-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessLineEntity,
      BusinessLineMemberEntity,
      BusinessLineInvitationEntity,
      AgentToolConfigEntity,
    ]),
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
    {
      provide: BusinessLineInvitationRepository,
      useClass: BusinessLineInvitationRelationalRepository,
    },
    {
      provide: AgentToolConfigRepository,
      useClass: AgentToolConfigRelationalRepository,
    },
  ],
  exports: [
    BusinessLineRepository,
    BusinessLineMemberRepository,
    BusinessLineInvitationRepository,
    AgentToolConfigRepository,
  ],
})
export class RelationalBusinessLinePersistenceModule {}
