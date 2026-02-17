import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessLineSeedService } from './business-line-seed.service';
import { BusinessLineEntity } from '../../../../business-lines/infrastructure/persistence/relational/entities/business-line.entity';
import { BusinessLineMemberEntity } from '../../../../business-lines/infrastructure/persistence/relational/entities/business-line-member.entity';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessLineEntity,
      BusinessLineMemberEntity,
      UserEntity,
    ]),
  ],
  providers: [BusinessLineSeedService],
  exports: [BusinessLineSeedService],
})
export class BusinessLineSeedModule {}
