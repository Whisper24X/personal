import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessLineEntity } from '../../../../business-lines/infrastructure/persistence/relational/entities/business-line.entity';
import { BusinessLineMemberEntity } from '../../../../business-lines/infrastructure/persistence/relational/entities/business-line-member.entity';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { BusinessLineMemberRole } from '../../../../business-lines/dto/business-line-member-role.enum';

@Injectable()
export class BusinessLineSeedService {
  constructor(
    @InjectRepository(BusinessLineEntity)
    private readonly businessLineRepository: Repository<BusinessLineEntity>,
    @InjectRepository(BusinessLineMemberEntity)
    private readonly businessLineMemberRepository: Repository<BusinessLineMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async run(): Promise<void> {
    const businessLineName = 'default-business-line';

    let businessLine = await this.businessLineRepository.findOne({
      where: {
        name: businessLineName,
      },
      withDeleted: false,
    });

    if (!businessLine) {
      businessLine = await this.businessLineRepository.save(
        this.businessLineRepository.create({
          name: businessLineName,
          description: 'Default business line for development',
        }),
      );
    }

    const adminUser = await this.userRepository.findOne({
      where: {
        username: 'admin',
      },
    });

    if (!adminUser) {
      return;
    }

    const existedMember = await this.businessLineMemberRepository.findOne({
      where: {
        businessLineId: businessLine.id,
        userId: adminUser.id,
      },
    });

    if (!existedMember) {
      await this.businessLineMemberRepository.save(
        this.businessLineMemberRepository.create({
          businessLineId: businessLine.id,
          userId: adminUser.id,
          role: BusinessLineMemberRole.owner,
        }),
      );
    }
  }
}
