import { NullableType } from '../../../utils/types/nullable.type';
import { TaskArtifact } from '../../domain/task-artifact';

export abstract class TaskArtifactRepository {
  abstract create(
    data: Omit<TaskArtifact, 'id' | 'createdAt'>,
  ): Promise<TaskArtifact>;

  abstract findByTaskId(
    taskId: TaskArtifact['taskId'],
  ): Promise<TaskArtifact[]>;

  abstract findById(
    id: TaskArtifact['id'],
  ): Promise<NullableType<TaskArtifact>>;
}
