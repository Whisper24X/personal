import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectExecutionSlot } from '../../../../domain/project-execution-slot';
import { ProjectExecutionSlotEntity } from '../entities/project-execution-slot.entity';
import { ProjectExecutionSlotMapper } from '../mappers/project-execution-slot.mapper';

@Injectable()
export class ProjectExecutionSlotRepository {
  constructor(
    @InjectRepository(ProjectExecutionSlotEntity)
    private readonly repo: Repository<ProjectExecutionSlotEntity>,
  ) {}

  async tryClaimSlot(
    projectId: string,
    taskId: string,
    ttlMs: number,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const slot = this.repo.create({
      projectId,
      taskId,
      claimedAt: new Date(),
      expiresAt,
    });
    try {
      await this.repo.save(slot);
      return true;
    } catch {
      return false;
    }
  }

  async updateContainerId(
    projectId: string,
    containerId: string,
  ): Promise<void> {
    await this.repo.update({ projectId }, { containerId });
  }

  async releaseSlot(projectId: string): Promise<void> {
    await this.repo.delete({ projectId });
  }

  async renewSlot(projectId: string, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.repo.update(
      { projectId },
      { expiresAt, heartbeatAt: new Date() },
    );
  }

  async findByProjectId(
    projectId: string,
  ): Promise<ProjectExecutionSlot | null> {
    const entity = await this.repo.findOne({ where: { projectId } });
    return entity ? ProjectExecutionSlotMapper.toDomain(entity) : null;
  }

  async findExpiredSlots(now: Date): Promise<ProjectExecutionSlot[]> {
    const entities = await this.repo
      .createQueryBuilder('slot')
      .where('slot.expiresAt < :now', { now })
      .orderBy('slot.expiresAt', 'ASC')
      .limit(50)
      .getMany();

    return entities.map((e) => ProjectExecutionSlotMapper.toDomain(e));
  }

  async findAll(): Promise<ProjectExecutionSlot[]> {
    const entities = await this.repo.find();
    return entities.map((e) => ProjectExecutionSlotMapper.toDomain(e));
  }
}
