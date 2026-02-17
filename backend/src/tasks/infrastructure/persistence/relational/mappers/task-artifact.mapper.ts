import { TaskArtifact } from '../../../../domain/task-artifact';
import { TaskArtifactEntity } from '../entities/task-artifact.entity';

export class TaskArtifactMapper {
  static toDomain(raw: TaskArtifactEntity): TaskArtifact {
    const domainEntity = new TaskArtifact();
    domainEntity.id = raw.id;
    domainEntity.taskId = raw.taskId;
    domainEntity.taskNodeId = raw.taskNodeId;
    domainEntity.artifactType = raw.artifactType;
    domainEntity.name = raw.name;
    domainEntity.downloadUrl = raw.downloadUrl;
    domainEntity.content = raw.content;
    domainEntity.metadata = raw.metadata;
    domainEntity.createdAt = raw.createdAt;

    return domainEntity;
  }
}
