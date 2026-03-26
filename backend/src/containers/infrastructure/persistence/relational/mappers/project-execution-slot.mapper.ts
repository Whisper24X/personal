import { ProjectExecutionSlot } from '../../../../domain/project-execution-slot';
import { ProjectExecutionSlotEntity } from '../entities/project-execution-slot.entity';

export class ProjectExecutionSlotMapper {
  static toDomain(entity: ProjectExecutionSlotEntity): ProjectExecutionSlot {
    const slot = new ProjectExecutionSlot();
    slot.id = entity.id;
    slot.projectId = entity.projectId;
    slot.taskId = entity.taskId;
    slot.containerId = entity.containerId ?? null;
    slot.accessMetadata =
      (entity.accessMetadata as
        | ProjectExecutionSlot['accessMetadata']
        | null
        | undefined) ?? null;
    slot.claimedAt = entity.claimedAt;
    slot.expiresAt = entity.expiresAt;
    slot.heartbeatAt = entity.heartbeatAt ?? null;
    return slot;
  }

  static toPersistence(
    domain: ProjectExecutionSlot,
  ): Partial<ProjectExecutionSlotEntity> {
    return {
      id: domain.id,
      projectId: domain.projectId,
      taskId: domain.taskId,
      containerId: domain.containerId ?? undefined,
      accessMetadata: domain.accessMetadata ?? undefined,
      claimedAt: domain.claimedAt,
      expiresAt: domain.expiresAt,
      heartbeatAt: domain.heartbeatAt ?? undefined,
    };
  }
}
