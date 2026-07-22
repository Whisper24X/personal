import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectExecutionSlot,
  SlotAccessMetadata,
} from '../../../../domain/project-execution-slot';
import { ProjectExecutionSlotEntity } from '../entities/project-execution-slot.entity';
import { ProjectExecutionSlotMapper } from '../mappers/project-execution-slot.mapper';

@Injectable()
export class ProjectExecutionSlotRepository {
  constructor(
    @InjectRepository(ProjectExecutionSlotEntity)
    private readonly repo: Repository<ProjectExecutionSlotEntity>,
  ) {}

  async claimSlotWithinLimit(
    projectId: string,
    taskId: string,
    ttlMs: number,
    maxSlots: number,
  ): Promise<'claimed' | 'existing' | 'limit_reached'> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + ttlMs);

    return this.repo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `project-execution-slots:${projectId}`,
      ]);

      await manager
        .createQueryBuilder()
        .delete()
        .from(ProjectExecutionSlotEntity)
        .where('"projectId" = :projectId', { projectId })
        .andWhere('"expiresAt" < :now', { now })
        .execute();

      const existingTaskSlot = await manager.findOne(
        ProjectExecutionSlotEntity,
        {
          where: { taskId },
        },
      );
      if (existingTaskSlot) {
        return 'existing' as const;
      }

      const activeSlotCount = await manager
        .createQueryBuilder(ProjectExecutionSlotEntity, 'slot')
        .where('slot.projectId = :projectId', { projectId })
        .andWhere('slot.expiresAt >= :now', { now })
        .getCount();
      if (activeSlotCount >= maxSlots) {
        return 'limit_reached' as const;
      }

      await manager.save(
        manager.create(ProjectExecutionSlotEntity, {
          projectId,
          taskId,
          claimedAt: now,
          expiresAt,
        }),
      );

      return 'claimed' as const;
    });
  }

  async countActiveSlotsByProjectId(
    projectId: string,
    now = new Date(),
  ): Promise<number> {
    return this.repo
      .createQueryBuilder('slot')
      .where('slot.projectId = :projectId', { projectId })
      .andWhere('slot.expiresAt >= :now', { now })
      .getCount();
  }

  async updateContainerIdByTaskId(
    taskId: string,
    containerId: string,
  ): Promise<void> {
    await this.repo.update({ taskId }, { containerId });
  }

  async updateContainerRuntimeByTaskId(
    taskId: string,
    params: {
      containerId: string;
      accessMetadata?: SlotAccessMetadata | null;
    },
  ): Promise<void> {
    await this.repo.update(
      { taskId },
      {
        containerId: params.containerId,
        accessMetadata: (params.accessMetadata as unknown as any) ?? null,
      },
    );
  }

  async releaseSlotByTaskId(taskId: string): Promise<void> {
    await this.repo.delete({ taskId });
  }

  async renewSlotByTaskId(taskId: string, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.repo.update({ taskId }, { expiresAt, heartbeatAt: new Date() });
  }

  async findByTaskId(taskId: string): Promise<ProjectExecutionSlot | null> {
    const entity = await this.repo.findOne({ where: { taskId } });
    return entity ? ProjectExecutionSlotMapper.toDomain(entity) : null;
  }

  async findActiveWithContainerByProjectId(
    projectId: string,
    now = new Date(),
  ): Promise<ProjectExecutionSlot | null> {
    const entity = await this.repo
      .createQueryBuilder('slot')
      .where('slot.projectId = :projectId', { projectId })
      .andWhere('slot.expiresAt >= :now', { now })
      .andWhere('slot.containerId IS NOT NULL')
      .orderBy('slot.heartbeatAt', 'DESC', 'NULLS LAST')
      .addOrderBy('slot.claimedAt', 'DESC')
      .getOne();

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
