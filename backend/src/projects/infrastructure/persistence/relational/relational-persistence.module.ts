import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRepository } from '../project.repository';
import { ProjectMemberRepository } from '../project-member.repository';
import { ProjectEntity } from './entities/project.entity';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectCustomRoleEntity } from './entities/project-custom-role.entity';
import { ProjectRelationalRepository } from './repositories/project.repository';
import { ProjectMemberRelationalRepository } from './repositories/project-member.repository';
import { ProjectCustomRoleRepository } from '../project-custom-role.repository';
import { ProjectCustomRoleRelationalRepository } from './repositories/project-custom-role.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      ProjectMemberEntity,
      ProjectCustomRoleEntity,
    ]),
  ],
  providers: [
    {
      provide: ProjectRepository,
      useClass: ProjectRelationalRepository,
    },
    {
      provide: ProjectMemberRepository,
      useClass: ProjectMemberRelationalRepository,
    },
    {
      provide: ProjectCustomRoleRepository,
      useClass: ProjectCustomRoleRelationalRepository,
    },
  ],
  exports: [ProjectRepository, ProjectMemberRepository, ProjectCustomRoleRepository],
})
export class RelationalProjectPersistenceModule {}
