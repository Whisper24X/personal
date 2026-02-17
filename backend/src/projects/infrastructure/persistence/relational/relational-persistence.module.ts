import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRepository } from '../project.repository';
import { ProjectMemberRepository } from '../project-member.repository';
import { ProjectEntity } from './entities/project.entity';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { ProjectRelationalRepository } from './repositories/project.repository';
import { ProjectMemberRelationalRepository } from './repositories/project-member.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, ProjectMemberEntity])],
  providers: [
    {
      provide: ProjectRepository,
      useClass: ProjectRelationalRepository,
    },
    {
      provide: ProjectMemberRepository,
      useClass: ProjectMemberRelationalRepository,
    },
  ],
  exports: [ProjectRepository, ProjectMemberRepository],
})
export class RelationalProjectPersistenceModule {}
