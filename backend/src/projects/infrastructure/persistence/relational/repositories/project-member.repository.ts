import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectMember } from '../../../../domain/project-member';
import { ProjectMemberRepository } from '../../project-member.repository';
import { ProjectMemberEntity } from '../entities/project-member.entity';
import { ProjectMemberMapper } from '../mappers/project-member.mapper';

@Injectable()
export class ProjectMemberRelationalRepository
  implements ProjectMemberRepository
{
  constructor(
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
  ) {}

  async findByProjectId(
    projectId: ProjectMember['projectId'],
  ): Promise<ProjectMember[]> {
    const entities = await this.projectMemberRepository.find({
      where: { projectId },
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => ProjectMemberMapper.toDomain(entity));
  }

  async findByUserId(
    userId: ProjectMember['userId'],
  ): Promise<ProjectMember[]> {
    const entities = await this.projectMemberRepository.find({
      where: { userId },
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => ProjectMemberMapper.toDomain(entity));
  }

  async findByProjectIdAndUserId(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
  ): Promise<NullableType<ProjectMember>> {
    const entity = await this.projectMemberRepository.findOne({
      where: {
        projectId,
        userId,
      },
    });

    return entity ? ProjectMemberMapper.toDomain(entity) : null;
  }

  async create(data: {
    projectId: ProjectMember['projectId'];
    userId: ProjectMember['userId'];
    role: ProjectMember['role'];
  }): Promise<ProjectMember> {
    const entity = await this.projectMemberRepository.save(
      this.projectMemberRepository.create(data),
    );

    return ProjectMemberMapper.toDomain(entity);
  }

  async update(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
    payload: Partial<ProjectMember>,
  ): Promise<NullableType<ProjectMember>> {
    const entity = await this.projectMemberRepository.findOne({
      where: {
        projectId,
        userId,
      },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectMemberRepository.save(
      this.projectMemberRepository.create({
        ...entity,
        role: payload.role ?? entity.role,
      }),
    );

    return ProjectMemberMapper.toDomain(updatedEntity);
  }

  async remove(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
  ): Promise<void> {
    await this.projectMemberRepository.delete({
      projectId,
      userId,
    });
  }

  async countByProjectIdAndRole(
    projectId: string,
    role: string,
  ): Promise<number> {
    return this.projectMemberRepository.count({
      where: {
        projectId,
        role,
      },
    });
  }
}
