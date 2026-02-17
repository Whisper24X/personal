import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Task } from '../../domain/task';
import { TaskStatus } from '../../dto/task-status.enum';

export abstract class TaskRepository {
  abstract create(
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Task>;

  abstract findById(id: Task['id']): Promise<NullableType<Task>>;

  abstract findAllWithPagination({
    paginationOptions,
    projectId,
    status,
  }: {
    paginationOptions: IPaginationOptions;
    projectId?: string;
    status?: TaskStatus;
  }): Promise<Task[]>;

  abstract countRunningTasks(at?: Date): Promise<number>;

  abstract countRunningTasksByProjectIds(
    projectIds: string[],
    at?: Date,
  ): Promise<Record<string, number>>;

  abstract countQueuedTasksByProjectIds(
    projectIds: string[],
    at?: Date,
  ): Promise<Record<string, number>>;

  abstract countStaleRunningTasks(at?: Date): Promise<number>;

  abstract findOldestQueuedTaskCreatedAt(at?: Date): Promise<Date | null>;

  abstract findTasksReadyForDispatch(limit: number, at?: Date): Promise<Task[]>;

  abstract update(
    id: Task['id'],
    payload: Partial<Task>,
  ): Promise<NullableType<Task>>;

  abstract remove(id: Task['id']): Promise<void>;
}
