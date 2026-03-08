import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectMember } from '../../../../domain/project-member';
import { ProjectMemberRepository } from '../../project-member.repository';
import { ProjectMemberEntity } from '../entities/project-member.entity';
import { ProjectMemberMapper } from '../mappers/project-member.mapper';

@Injectable()
export class ProjectMemberRelationalRepository implements ProjectMemberRepository {
  constructor(
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
  ) {}

  async findByProjectId(projectId: ProjectMember['projectId']): Promise<ProjectMember[]> {
    const entities = await this.projectMemberRepository.find({
      where: { projectId },
      relations: { roleRef: true },
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => ProjectMemberMapper.toDomain(entity));
  }

  async findByUserId(userId: ProjectMember['userId']): Promise<ProjectMember[]> {
    const entities = await this.projectMemberRepository.find({
      where: { userId },
      relations: { roleRef: true },
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => ProjectMemberMapper.toDomain(entity));
  }

  async findByProjectIdAndUserId(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
  ): Promise<NullableType<ProjectMember>> {
    const entity = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
      relations: { roleRef: true },
    });

    return entity ? ProjectMemberMapper.toDomain(entity) : null;
  }

  async create(data: {
    projectId: ProjectMember['projectId'];
    userId: ProjectMember['userId'];
    roleId: ProjectMember['roleId'];
  }): Promise<ProjectMember> {
    const saved = await this.projectMemberRepository.save(
      this.projectMemberRepository.create(data),
    );

    const entity = await this.projectMemberRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { roleRef: true },
    });

    return ProjectMemberMapper.toDomain(entity);
  }

  async update(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
    payload: Partial<ProjectMember>,
  ): Promise<NullableType<ProjectMember>> {
    const entity = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.projectMemberRepository.save(
      this.projectMemberRepository.create({
        ...entity,
        roleId: payload.roleId ?? entity.roleId,
      }),
    );

    const nextEntity = await this.projectMemberRepository.findOneOrFail({
      where: { id: updatedEntity.id },
      relations: { roleRef: true },
    });

    return ProjectMemberMapper.toDomain(nextEntity);
  }

  async remove(projectId: ProjectMember['projectId'], userId: ProjectMember['userId']): Promise<void> {
    await this.projectMemberRepository.delete({ projectId, userId });
  }

  async countByProjectIdAndRoleId(projectId: string, roleId: string): Promise<number> {
    return this.projectMemberRepository.count({
      where: { projectId, roleId },
    });
  }
}
